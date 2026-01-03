import { AlaSQLTable, AlaSQLColumn } from '../types';

export class SchemaReconstructor {
    /**
     * Reconstructs a CREATE TABLE statement from AlaSQL's internal table object.
     * This is necessary because AlaSQL's SHOW CREATE TABLE is often incomplete.
     */
    static reconstruct(tableName: string, table: AlaSQLTable): string {
        if (!table.columns || table.columns.length === 0) {
            return `CREATE TABLE ${tableName} (id INT)`; // Fallback for purely empty tables?
        }

        const columnDefs = table.columns.map(col => {
            const parts = [`\`${col.columnid}\``];

            // Type
            parts.push(col.dbtypeid || 'VARCHAR');

            // Constraints
            if (col.notnull) parts.push('NOT NULL');

            // Auto Increment
            // Check both properties and the separate identities object
            const isIdentity = (table.identities && table.identities[col.columnid]) || col.identity || col.auto_increment;
            if (isIdentity) parts.push('AUTO_INCREMENT');

            // Primary Key
            // Check both properties and the separate pk object
            const isPK = (table.pk && table.pk.columns && table.pk.columns.includes(col.columnid)) || col.primarykey;
            if (isPK) parts.push('PRIMARY KEY');

            // Default Value
            // This is the hardest part as it's often a unified string in defaultfns
            const defaultVal = this.extractDefaultValue(col, table);
            if (defaultVal) parts.push(`DEFAULT ${defaultVal}`);

            return parts.join(' ');
        });

        return `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs.join(', ')})`;
    }

    private static extractDefaultValue(col: AlaSQLColumn, table: AlaSQLTable): string | null {
        // 1. Explicit simple value
        if (col.dflt_value !== undefined) {
            if (typeof col.dflt_value === 'string') return `'${col.dflt_value}'`;
            if (typeof col.dflt_value === 'number' || typeof col.dflt_value === 'boolean') return String(col.dflt_value);
            // Fallback for other types
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return String(col.dflt_value as any);
        }

        // 2. Try to parse from defaultfns string if available
        // Format is usually: "colName":fn(), "colName2":fn2()
        if (table.defaultfns) {
            const fnStr = table.defaultfns;
            // Very basic heuristic for NOW()
            if (fnStr.includes(`"${col.columnid}":alasql.stdfn["NOW"]`)) {
                return 'NOW()';
            }
            // Heuristic for UUID()
            if (fnStr.includes(`"${col.columnid}":alasql.stdfn["UUID"]`)) {
                return 'UUID()';
            }
        }

        return null;
    }
}
