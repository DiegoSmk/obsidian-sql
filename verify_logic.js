
// Mock Obsidian classes
class HTMLElement {
    constructor() {
        this.children = [];
        this.classList = { add: (c) => console.log(`[Class Added]: ${c}`) };
        this.style = {};
    }
    createEl(tag, opts) {
        console.log(`[CreateEl]: <${tag}> ${opts?.text || ''}`);
        const el = new HTMLElement();
        this.children.push(el);
        return el;
    }
    addClass(c) { console.log(`[Class Added]: ${c}`); }
}

global.HTMLElement = HTMLElement;

const alasql = require('alasql');
alasql.options.mysql = true;

async function testPluginLogic() {
    console.log("--- Starting Simulation ---");
    const code = `
    CREATE DATABASE IF NOT EXISTS empresa;
    USE empresa;
    
    CREATE TABLE funcionarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(100),
      salario DECIMAL(10,2)
    );
    
    INSERT INTO funcionarios (nome, salario)
    VALUES ('Ana', 5000), ('Carlos', 4200);
    
    SELECT * FROM funcionarios;
    `;

    try {
        console.log("Executing SQL...");
        const result = await alasql.promise(code);
        console.log("\n--- Raw Result ---");
        console.log(JSON.stringify(result, null, 2));

        console.log("\n--- Rendering Logic Simulation ---");

        // Simulate renderResult logic
        if (Array.isArray(result)) {
            const isMultiStatement = result.length > 0 && (Array.isArray(result[0]) || (result[0] && typeof result[0] === 'number') || (result[0]?.affectedRows !== undefined));

            if (isMultiStatement) {
                console.log("Detected Multi-Statement Result");
                result.forEach((subResult, i) => {
                    console.log(`\nResult ${i}:`);
                    if (Array.isArray(subResult)) {
                        console.log(`Table with ${subResult.length} rows`);
                        if (subResult.length > 0) console.log("Columns:", Object.keys(subResult[0]));
                    } else {
                        console.log("Metadata/Count:", subResult);
                    }
                });
            } else {
                console.log("Single Result:", result);
            }
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

testPluginLogic();
