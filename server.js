const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the Express server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Setup PeerServer integrated with Express
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/'
});

// Use the peerServer middleware at /peerjs
app.use('/peerjs', peerServer);

console.log('PeerServer integrated at /peerjs');
