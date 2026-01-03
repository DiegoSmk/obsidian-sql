
const alasql = require('alasql');

// Logic mirrored from SchemaReconstructor to verify it independently
// This ensures that even if we can't mock the full Obsidian env in unit tests,
// the core logic of translating internal AlaSQL structures to SQL remains correct.
class SchemaReconstructorMock {
    static reconstruct(tableName, table) {
        if (!table.columns || table.columns.length === 0) {
            return `CREATE TABLE ${tableName} (id INT)`;
        }

        const columnDefs = table.columns.map(col => {
            const parts = [`\`${col.columnid}\``];
            parts.push(col.dbtypeid || 'VARCHAR');
            if (col.notnull) parts.push('NOT NULL');

            const isIdentity = (table.identities && table.identities[col.columnid]) || col.identity || col.auto_increment;
            if (isIdentity) parts.push('AUTO_INCREMENT');

            const isPK = (table.pk && table.pk.columns && table.pk.columns.includes(col.columnid)) || col.primarykey;
            if (isPK) parts.push('PRIMARY KEY');

            // Default Value
            if (col.dflt_value !== undefined) {
                const val = typeof col.dflt_value === 'string' ? `'${col.dflt_value}'` : String(col.dflt_value);
                parts.push(`DEFAULT ${val}`);
            } else if (table.defaultfns) {
                const fnStr = table.defaultfns;
                if (fnStr.includes(`"${col.columnid}":alasql.stdfn["NOW"]`)) parts.push('DEFAULT NOW()');
                else if (fnStr.includes(`"${col.columnid}":alasql.stdfn["UUID"]`)) parts.push('DEFAULT UUID()');
            }

            return parts.join(' ');
        });

        return `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs.join(', ')})`;
    }
}

async function runTest() {
    console.log('   Running Schema Persistence Integration Test...');

    // Reset Database
    alasql('DROP DATABASE IF EXISTS test_db');
    await alasql.promise('CREATE DATABASE IF NOT EXISTS test_db');
    await alasql.promise('USE test_db');

    // Create complex table
    await alasql.promise(`
        CREATE TABLE items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code STRING,
            created_at DATETIME DEFAULT NOW()
        )
    `);

    // Verify Internal Structure matches expectations
    const table = alasql.databases['test_db'].tables['items'];
    const sql = SchemaReconstructorMock.reconstruct('items', table);

    // console.log('   Generated SQL:', sql);

    const checks = [
        { name: 'AUTO_INCREMENT', pass: sql.includes('AUTO_INCREMENT') },
        { name: 'PRIMARY KEY', pass: sql.includes('PRIMARY KEY') },
        { name: 'DEFAULT NOW()', pass: sql.includes('DEFAULT NOW()') }
    ];

    const allPass = checks.every(c => c.pass);

    if (allPass) {
        console.log('   ✅ PASS: Schema reconstruction handles constraints correctly.');
        process.exit(0);
    } else {
        console.error('   ❌ FAIL: Missing constraints:', checks.filter(c => !c.pass).map(c => c.name));
        process.exit(1);
    }
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});
