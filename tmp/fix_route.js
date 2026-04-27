const fs = require('fs');
const path = 'c:\\Users\\eesa\\OneDrive\\Desktop\\car dealer software\\src\\app\\api\\vehicles\\route.ts';
let content = fs.readFileSync(path, 'utf8');

// Find ANY line containing a literal backslash-n (the two chars \ and n together)
// These would show up after splitting on actual newlines
const lines = content.split(/\r\n|\n/);
let found = false;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for literal backslash (char 92) followed by n (char 110)
    for (let j = 0; j < line.length - 1; j++) {
        if (line.charCodeAt(j) === 92 && line.charCodeAt(j+1) === 110) {
            console.log(`Found literal \\n at line ${i+1}, col ${j+1}`);
            console.log(`Line: ${JSON.stringify(line)}`);
            // Split at the backslash-n
            const before = line.slice(0, j);
            const after = line.slice(j+2).trimStart(); // skip \ and n, trim leading spaces
            lines[i] = before;
            lines.splice(i+1, 0, '                    ' + after);
            found = true;
            break;
        }
    }
    if (found) break;
}

if (found) {
    fs.writeFileSync(path, lines.join('\r\n'), 'utf8');
    console.log('FIXED and written!');
} else {
    console.log('No literal backslash-n found in any line!');
    // Show all lines with backslashes for debugging
    lines.slice(465, 472).forEach((l, i) => {
        console.log(`L${466+i}: ${JSON.stringify(l)}`);
    });
}
