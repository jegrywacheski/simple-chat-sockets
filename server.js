if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");

const bcrypt = require("bcrypt");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const initializePassport = require("./passport-config");
const passport = require("passport");
const { join } = require("node:path");

const users = [];
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
  },
});

initializePassport(
  passport,
  (email) => users.find((user) => user.email === email),
  (id) => users.find((user) => user.id === id)
);

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

// app.get("/", (req, res) => {
//   res.sendFile(join(__dirname, "index.html"));
// });

app.get("/", checkAuthenticated, (req, res) => {
  res.render("index.ejs", { user: req.user });
});

app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});
app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});
app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    users.push({
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });
    res.redirect("/login");
  } catch {
    res.redirect("/register");
  }
  console.log(users);
});

app.delete("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// app.listen(3000);
server.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});

const connected = {};

io.on("connection", (socket) => {
  socket.on("new-user", (name) => {
    connected[socket.id] = name;
    console.log("a user connected: ", name);
    socket.broadcast.emit("user-connected", name);
  });
  socket.on("send-chat-message", (message) => {
    console.log("message: ", message);
    socket.broadcast.emit("chat-message", {
      message: message,
      name: connected[socket.id],
    });
  });
  socket.on("disconnect", () => {
    console.log("a user disconnected");
    socket.broadcast.emit("user-disconnected", connected[socket.id]);
    delete connected[socket.id];
  });
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}
