// const jwt = require('jsonwebtoken');

// function validateToken(req, res, next) {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) {
//     return res.status(401).json({ error: 'Token de autorização necessário' });
//   }

//   const token = authHeader.replace('Bearer ', '');

//   try {
//     const secret = process.env.JWT_SECRET;
//     const payload = jwt.verify(token, secret);
//     req.user = payload; // geralmente inclui id, email, etc
//     next();
//   } catch (err) {
//     return res.status(401).json({ error: 'Token inválido' });
//   }
// }

// module.exports = { validateToken };
