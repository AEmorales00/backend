"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const HOST = process.env.HOST || '127.0.0.1';
process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
const server = app_1.default.listen(PORT, HOST, () => {
    console.log(`API corriendo en http://${HOST}:${PORT}`);
});
server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
// Graceful shutdown
const shutdown = () => {
    console.log('\nShutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
    // Force close after 5 seconds
    setTimeout(() => {
        console.error('Forcing shutdown');
        process.exit(1);
    }, 5000);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGUSR2', shutdown); // For nodemon restarts
//# sourceMappingURL=server.js.map