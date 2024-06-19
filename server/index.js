const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
const MONGODB_URI = 'mongodb://0.0.0.0:27017/loginDB';
const cookieParser = require("cookie-parser")
const jwt = require("jsonwebtoken")
const dotenv = require('dotenv').config()

app.use(cors({
  origin : ["http://localhost:3000"],
  methods : ["GET","POST"],
  credentials : true
}));
app.use(express.json());
app.use(cookieParser())
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

const loginSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  resetOTP: String,
  resetTimestamp: Number,
});

const LoginForm = mongoose.model('LoginForm', loginSchema);
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Nodemailer configuration

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ceitkesavan25@gmail.com',
    pass: 'vnbr iwbx barl yjct',
  },
});

app.post('/register', (req, res) => {
  const { firstName, email, password } = req.body;

  LoginForm.findOne({ email: email })
    .then(existingUser => {
      if (existingUser) {
        res.status(400).send('Email already exists');
      } else {
        const newForm = new LoginForm({
          name: firstName,
          email: email,
          password: password,
        });

        newForm.save()
          .then((result) => {
            console.log('New user registered:', result);
            res.status(201).send('User registered successfully');
          })
          .catch((error) => {
            console.error('Error registering user:', error);
            res.status(500).send('Internal server error');
          });
      }
    })
    .catch(error => {
      console.error('Error checking existing user:', error);
      res.status(500).send('Internal server error');
    });
});



app.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  LoginForm.findOne({ email: email })
    .then((user) => {
      if (user) {
        if (user.password === password) {
          const accessToken = jwt.sign(
            {
              email: user.email,
            },
            process.env.PASS_KEY,
            { expiresIn: "1d" }
          );

          console.log(accessToken);
          res.json({"token": accessToken, data : "success" })
        //  res.cookie("token", accessToken);
        } else {
          res.json("UnSuccess");
          console.log("Incorrect password");
        }
      } else {
        res.json("UnSuccess");
        console.log("No record exists");
      }
    })
    .catch(error => {
      console.error('Error finding user:', error);
      res.status(500).send('Internal server error');
    });
});



app.post("/verify", async(req,res)=>{
  const {tokenVerify} = req.body;
  console.log(tokenVerify);
  try {
    const decoded = jwt.decode(tokenVerify);
    console.log(decoded);
    LoginForm.findOne({email : decoded.email})
    .then((response) => {
      
      if ( response!== null) {
        res.status(200).send("User Found")
      }
      else {
        res.status(404).send("User not found")
      }
    })

    .catch((err)=> console.log(err.message))
  } catch (error) {
    console.error('Error decoding token:', error);
  }
})




app.post('/reset-password/request-reset', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await LoginForm.findOne({ email });

    if (user) {
      const otp = generateOTP();
      user.resetOTP = otp;
      user.resetTimestamp = Date.now() + 15 * 60 * 1000;
      await user.save();

      // Send OTP to the user's email
      const mailOptions = {
        from: 'kesavan8388@gmail.com',
        to: user.email,
        subject: 'Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          res.status(500).json({ success: false, message: 'Error sending OTP email' });
        } else {
          console.log('Email sent: ' + info.response);
          res.json({ success: true, message: 'OTP sent successfully' });
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ... (unchanged code for requesting password reset)

app.post('/reset-password/validate-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await LoginForm.findOne({ email });

    console.log('User:', user); // Log the user object

    console.log('Entered OTP:', otp); // Log entered OTP

    if (user && user.resetOTP === otp && user.resetTimestamp > Date.now()) {
      console.log('Valid OTP:', user.resetOTP); // Log the OTP stored in the database
      res.json({ success: true, message: 'OTP is valid' });
    } else {
      console.log('Invalid or Expired OTP:', user ? user.resetOTP : null); // Log the OTP stored in the database if user is not null
      res.status(400).json({ success: false, message: 'Invalid OTP or OTP expired' });
    }
  } catch (error) {
    console.error('Error validating OTP:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});




app.post('/reset-password/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await LoginForm.findOne({ email });

    if (user) {
      // Update the password and clear the reset OTP fields
      user.password = newPassword;
      user.resetOTP = undefined;
      user.resetTimestamp = undefined;
      await user.save();

      res.json({ success: true, message: 'Password reset successful' });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
