const fs = require('fs');
const content = fs.readFileSync('/Users/bruno/Desktop/quotex2.0-main/index.html', 'utf8');
const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/g);
if (scriptMatch) {
    scriptMatch.forEach((s, i) => {
        const code = s.replace('<script>', '').replace('</script>', '');
        fs.writeFileSync(`script_${i}.js`, code);
        console.log(`Saved script_${i}.js`);
        try {
            require('child_process').execSync(`node -c script_${i}.js`);
            console.log(`script_${i}.js is valid`);
        } catch (e) {
            console.error(`Error in script_${i}.js:`, e.message);
        }
    });
}
