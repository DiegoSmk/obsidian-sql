
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
    empty() { console.log(`[Empty]`); }
}

global.HTMLElement = HTMLElement;

const alasql = require('alasql');
alasql.options.mysql = true;

function cleanSQL(sql) {
    // AlaSQL doesn't support some MySQL DDL options like Charset/Collate/Engine
    // We strip them out to avoid parse errors.
    let cleaned = sql
        .replace(/DEFAULT CHARACTER SET\s+[\w\d_]+/gi, "")
        .replace(/CHARACTER SET\s+[\w\d_]+/gi, "")
        .replace(/DEFAULT COLLATE\s+[\w\d_]+/gi, "")
        .replace(/COLLATE\s+[\w\d_]+/gi, "")
        .replace(/ENGINE\s*=\s*[\w\d_]+/gi, "");

    return cleaned;
}

async function testPluginLogic() {
    console.log("--- Starting Simulation with Error Case ---");
    const code = `
    CREATE DATABASE IF NOT EXISTS empresa
    DEFAULT CHARACTER SET utf8
    DEFAULT COLLATE utf8_general_ci;

    USE empresa;
    
    CREATE TABLE IF NOT EXISTS funcionarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        departamento VARCHAR(50) NOT NULL,
        salario DECIMAL(10, 2) NOT NULL,
        data_admissao DATE NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    `;

    console.log("Original Code:");
    console.log(code);

    const cleanedCode = cleanSQL(code);
    console.log("\nCleaned Code:");
    console.log(cleanedCode);

    try {
        console.log("\nExecuting SQL...");
        const result = await alasql.promise(cleanedCode);
        console.log("\n--- Success! Result ---");
        console.log(JSON.stringify(result, null, 2));

    } catch (e) {
        console.error("\n--- Error ---");
        console.error(e.message);
    }
}

testPluginLogic();
