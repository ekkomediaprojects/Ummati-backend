// In-memory store for blacklisted tokens
const blacklistedTokens = new Set();

// Function to blacklist a token
const blacklistToken = (token) => {
    blacklistedTokens.add(token);
};

// Function to check if a token is blacklisted
const isTokenBlacklisted = (token) => {
    return blacklistedTokens.has(token);
};

module.exports = { blacklistToken, isTokenBlacklisted };
