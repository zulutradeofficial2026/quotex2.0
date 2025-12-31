const fs = require("fs");
const path = require("path");

const template = fs.readFileSync("./content/generator-template.html", "utf8");

function createArticle(title, description, content) {
    let html = template
        .replace(/{{title}}/g, title)
        .replace("{{description}}", description)
        .replace("{{content}}", content);

    const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".html";
    const filepath = path.join("./content", filename);

    fs.writeFileSync(filepath, html);
    console.log("Article created:", filepath);
}

createArticle(
    process.argv[2] || "Daily Crypto Update by Anas Ali Trader",
    "Latest crypto insights and analysis from Anas Ali Trader in Pakistan and UAE.",
    "Today’s market update: BTC, ETH, USDT analysis, global news, and UAE–Pakistan trading movements."
);
