const cors = require("cors");
const { Server, EVENTS } = require("@tus/server");
const { FileStore } = require("@tus/file-store");
const express = require("express");
const fs = require("fs");
const path = require("path");
const diskusage = require("diskusage");
const os = require("os");

const { promisify } = require("util");
const fsRename = promisify(fs.rename);

const host = "127.0.0.1";
const port = 1080;
const app = express();

const corsOptions = {
  origin: "*", // allow all origins
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Include 'PATCH'
  allowedHeaders: [
    "Content-Type",
    "Origin",
    "Accept",
    "Tus-Resumable",
    "Upload-Length",
    "Upload-Offset",
  ], // Include necessary tus headers
};

// Separate tus servers for each content type
const movieServer = new Server({
  path: "/",
  datastore: new FileStore({ directory: "./files/movies" }),
});

const musicServer = new Server({
  path: "/",
  datastore: new FileStore({ directory: "./files/music" }),
});

const bookServer = new Server({
  path: "/",
  datastore: new FileStore({ directory: "./files/books" }),
});

// Metadata storage
const fileMetadata = {};
let filePath = "";

[movieServer, musicServer, bookServer].forEach((server) => {
  server.on(EVENTS.POST_FINISH, async (event) => {
    const data = event.originalUrl.split("/");

    const dataPath = `.\\files\\${data[data.length - 2]}\\${
      data[data.length - 1]
    }.json`;
    filePath = dataPath;
    fs.readFile(filePath, "utf8", (err, jsonString) => {
      if (err) {
        console.log("File read failed:", err);
        return;
      }
      const metaDataJson = JSON.parse(jsonString);
      const oldInternalPath = `.\\files\\${data[data.length - 2]}\\${
        data[data.length - 1]
      }`;
      const oldPath = path.join(__dirname, oldInternalPath);
      const newinternalPath = `.\\files\\${data[data.length - 2]}\\${
        metaDataJson.metadata.filename
      }`;
      const newPath = path.join(__dirname, newinternalPath);
      fs.rename(oldPath, newPath, (err) => {
        if (err) throw err;
        console.log("Rename complete!");
      });

      const oldInternalPathJSON = `.\\files\\${data[data.length - 2]}\\${
        data[data.length - 1]
      }.json`;
      const oldPathJSON = path.join(__dirname, oldInternalPathJSON);
      const newinternalPathJSON = `.\\files\\${data[data.length - 2]}\\${
        metaDataJson.metadata.filename
      }.json`;
      const newPathJSON = path.join(__dirname, newinternalPathJSON);
      fs.rename(oldPathJSON, newPathJSON, (err) => {
        if (err) throw err;
        console.log("Rename complete!");
      });
    });
  });
});

// Separate express apps for each server
const movieApp = express();
const musicApp = express();
const bookApp = express();

movieApp.use(cors(corsOptions));
musicApp.use(cors(corsOptions));
bookApp.use(cors(corsOptions));

movieApp.all("*", movieServer.handle.bind(movieServer));
musicApp.all("*", musicServer.handle.bind(musicServer));
bookApp.all("*", bookServer.handle.bind(bookServer));

app.use("/uploads/movies", movieApp);
app.use("/uploads/music", musicApp);
app.use("/uploads/books", bookApp);

// Endpoint to check if a file exists
app.get("/uploads/:contentType/:fileId", (req, res) => {
  const { contentType, fileId } = req.params;
  const metadata = fileMetadata[fileId];
  if (!metadata) {
    return res.status(404).send({ message: "File not found" });
  }
  const fileName = metadata.filename;
  const filePath = path.join(__dirname, "files", contentType, fileName);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send({ message: "File not found" });
    } else {
      return res.send({ message: "File exists" });
    }
  });
});

// Endpoint to delete a file
app.delete("/uploads/:contentType/:fileId", (req, res) => {
  const { contentType, fileId } = req.params;
  const metadata = fileMetadata[fileId];
  if (!metadata) {
    return res.status(404).send({ message: "File not found" });
  }
  const fileName = metadata.filename;
  const filePath = path.join(__dirname, "files", contentType, fileName);

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(404).send({ message: "File not found" });
    } else {
      delete fileMetadata[fileId];
      return res.send({ message: "File deleted" });
    }
  });
});

// Endpoint to get server stats
app.get("/stats", (req, res) => {
  diskusage.check("/", (err, info) => {
    if (err) {
      console.log(err);
      return res
        .status(500)
        .send({ message: "Error getting disk usage information" });
    }

    res.send({
      totalDisk: info.total,
      freeDisk: info.free,
    });
  });
});

app.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
