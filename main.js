const cors = require('cors');
const { Server } = require('@tus/server');
const { FileStore } = require('@tus/file-store');
const express = require('express');

const host = '127.0.0.1';
const port = 1080;
const app = express();
const uploadApp = express();
const server = new Server({
  path: '/files',
  datastore: new FileStore({ directory: './files' }),
});

const corsOptions = {
  origin: '*', // allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Include 'PATCH'
  allowedHeaders: ['Content-Type', 'Origin', 'Accept', 'Tus-Resumable', 'Upload-Length', 'Upload-Offset'] // Include necessary tus headers
};

app.use(cors(corsOptions));
uploadApp.use(cors(corsOptions));

// Handle all routes
uploadApp.all('*', server.handle.bind(server));

app.use('/uploads', uploadApp);

app.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
