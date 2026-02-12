const express = require("express");
const multer = require("multer");
const {
uploadFile,createFolder, listFiles
} = require("./fileController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), uploadFile);
router.post("/create-folder", createFolder);
router.get("/list", listFiles);

module.exports = router;
