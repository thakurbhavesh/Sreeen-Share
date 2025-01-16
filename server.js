const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {}; // Store room data
const participants = {}; // Track participants in each room

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle setting user name
  socket.on("set-name", (name) => {
    socket.name = name;
    console.log(`User ${socket.id} set name: ${name}`);
  });

  // Handle room creation
  socket.on("create-room", (code) => {
    rooms[code] = socket.id;
    participants[code] = [{ id: socket.id, name: socket.name }]; // Add creator to participants list
    socket.join(code);
    console.log(`Room created: ${code}`);
    socket.emit("room-created", code);
  });

  // Handle joining a room
  socket.on("join-room", (code) => {
    if (rooms[code]) {
      socket.join(code);
      participants[code].push({ id: socket.id, name: socket.name }); // Add new participant
      console.log(`User ${socket.id} joined room: ${code}`);
      io.to(rooms[code]).emit("user-connected", { id: socket.id, name: socket.name });
      io.to(code).emit("participants-updated", participants[code]); // Update participants list
      io.to(code).emit("notification", `${socket.name} joined the room.`);
    } else {
      socket.emit("invalid-room");
    }
  });

 

  // Relay WebRTC signaling data
  socket.on("signal", (data) => {
    socket.to(data.target).emit("signal", data);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    for (let code in rooms) {
      if (rooms[code] === socket.id) {
        delete rooms[code]; // Delete room if creator leaves
        delete participants[code]; // Delete participants list
        io.to(code).emit("room-closed");
        break;
      } else if (participants[code]?.some((p) => p.id === socket.id)) {
        participants[code] = participants[code].filter((p) => p.id !== socket.id); // Remove participant
        io.to(code).emit("participants-updated", participants[code]); // Update participants list
        io.to(code).emit("notification", `${socket.name} left the room.`);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});