const mongoose = require('mongoose');

const dbConnection = () => {
  return mongoose.connect(process.env.DB_URI).then((conn) => {
    console.log(`Database Connected: ${conn.connection.host}`);
    return conn;
  });
};

module.exports = dbConnection;
