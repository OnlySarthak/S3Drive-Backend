const express = require("express");
const multer = require("multer");
const {
uploadFile,
listFiles, 
viewFile,
deleteFile,
downloadFile,
createFolder
} = require("./fileController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), uploadFile);
router.post("/create-folder", createFolder);
router.get("/list", listFiles);
router.get("/download", downloadFile);
router.delete("/delete", deleteFile);
router.get("/create-folder", createFolder);
router.get("/view/:path", viewFile);

module.exports = router;
