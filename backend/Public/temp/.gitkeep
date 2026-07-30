import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    // req contail all data like json and form data file contain the actual file like video photo etc , cb is callback function 
    filename: function (req, file, cb) {  
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9) // to get a unique name for each uploaded file
      cb(null, file.originalname + '-' + uniqueSuffix)
    }
  })
  
export const upload = multer({ 
    storage, removeDestination: true 
 })