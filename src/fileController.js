const {
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");


const s3 = require("./utils/s3");

const BUCKET = process.env.AWS_BUCKET_NAME;

/**
 * Allowed MIME types
 */
const allowedTypes = [
  "audio/mpeg",
  "audio/wav",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

exports.uploadFile = async (req, res) => {
  try {
    const file = req.file;
    // const currentPath = req.body.path || "";
    const currentPath = req.body.path || "";

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    const key = `${currentPath}${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    });

    await s3.send(command);

    res.status(200).json({
      message: "File uploaded successfully",
      key
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
};

exports.listFiles = async (req, res) => {
  try {

    const prefix = req.query.path || "";

    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      Delimiter: "/"
    });

    const data = await s3.send(command);

    const folders = (data.CommonPrefixes || []).map(p => ({
      type: "folder",
      name: p.Prefix.replace(prefix, "").replace("/", ""),
      path: p.Prefix
    }));

    const files = await Promise.all(
      (data.Contents || [])
        .filter(item => item.Key !== prefix)
        .map(async (item) => {
          const fileName = item.Key.replace(prefix, "");

          const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: item.Key,
          });

          const signedUrl = await getSignedUrl(s3, command, {
            expiresIn: 3600, // 1 hour
          });

          return {
            type: "file",
            name: fileName,
            path: item.Key,
            fileType: getFileCategory(fileName),
            url: signedUrl, // ⭐ THIS IS THE MAGIC
          };
        })
    );


    res.status(200).json({
      currentPath: prefix,
      folders,
      files
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Listing failed" });
  }
};

function getFileCategory(fileName) {
  if (fileName.match(/\.(mp3|wav)$/i)) return "audio";
  if (fileName.match(/\.json$/i)) return "json";
  if (fileName.match(/\.(png|jpg|jpeg|webp)$/i)) return "image";
  if (fileName.match(/\.pdf$/i)) return "pdf";
  return "other";
}

exports.createFolder = async (req, res) => {
  try {
    const { path, folderName } = req.body;
    console.log(req.body);
    
    if (!folderName) {
      return res.status(400).json({ message: "Folder name required" });
    }

    const folderKey = `${path || ""}${folderName}/`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: folderKey,
      Body: ""
    });

    await s3.send(command);

    res.status(200).json({ message: "Folder created", folderKey });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Folder creation failed" });
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ message: "File path required" });
    }
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: path,
    });
    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600, // 1 hour
    });
    res.status(200).json({ url: signedUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Download failed" });
  }
};

exports.viewFile = async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) {
      return res.status(400).json({ message: "File path required" });
    }
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: path,
    });
    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600, // 1 hour
    });
    res.status(200).json({ url: signedUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "View failed" });
  }
};


exports.deleteFile = async (req, res) => {
  try {
    const { path, isFolder } = req.query;

    if (!path) {
      return res.status(400).json({
        message: "File path is required",
      });
    }

    // 🧠 FOLDER DELETE (recursive)
    if (isFolder === "true") {
      let continuationToken = undefined;
      let objectsDeleted = 0;

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: path,
          ContinuationToken: continuationToken,
        });

        const data = await s3.send(listCommand);

        if (data.Contents?.length) {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: {
              Objects: data.Contents.map((item) => ({
                Key: item.Key,
              })),
            },
          });

          await s3.send(deleteCommand);
          objectsDeleted += data.Contents.length;
        }

        continuationToken = data.NextContinuationToken;
      } while (continuationToken);

      return res.status(200).json({
        message: "Folder deleted successfully",
        deletedCount: objectsDeleted,
        path,
      });
    }

    // 🧠 SINGLE FILE DELETE
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: path,
    });

    await s3.send(command);

    return res.status(200).json({
      message: "File deleted successfully",
      path,
    });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({
      message: "Failed to delete file",
    });
  }
};

