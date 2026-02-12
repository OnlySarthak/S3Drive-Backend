const {
    PutObjectCommand,
    ListObjectsV2Command
} = require("@aws-sdk/client-s3");

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
    "image/webp"
];

exports.uploadFile = async (req, res) => {
    try {
        const file = req.file;
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

    const files = (data.Contents || [])
      .filter(item => item.Key !== prefix)
      .map(item => {
        const fileName = item.Key.replace(prefix, "");

        return {
          type: "file",
          name: fileName,
          path: item.Key,
          fileType: getFileCategory(fileName)
        };
      });

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
  return "other";
}


exports.createFolder = async (req, res) => {
    try {
        const { path, folderName } = req.body;

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
