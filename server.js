// server.js
const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para obtener los datos del archivo JSON
app.get('/data/document.json', (req, res) => {
  fs.readFile(path.join(__dirname, 'data', 'document.json'), 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Error reading data');
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Servir el archivo HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar el servidor en el puerto 3000
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});