// Treat search keywords as literal text, not regular expressions.
module.exports = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
