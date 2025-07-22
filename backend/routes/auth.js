// const express = require('express');
// const router = express.Router();
// const jwt = require('jsonwebtoken');

// const users = [
//   { id: 1, email: 'lukiiinhascaldeira96.lc@gmail.com', senha: 'Lucas1996' }
// ];

// router.post('/login', (req, res) => {
//   const { email, senha } = req.body;

//   const user = users.find(u => u.email === email && u.senha === senha);
//   if (!user) {
//     return res.status(401).json({ error: 'Credenciais inválidas' });
//   }

//   const token = jwt.sign({ id: user.id, email: user.email }, 'segredo', {
//     expiresIn: '1h'
//   });

//   res.json({ token });
// });

// module.exports = router;
