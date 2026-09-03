const fs = require('fs');
const pdfParse = require('pdf-parse');
(async () => {
  const { text } = await pdfParse(fs.readFileSync(process.argv[2]));
  console.log('=== LEN', text.length);
  console.log(text);
})();
