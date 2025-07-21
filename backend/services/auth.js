const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const validateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token de autorização necessário' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return res.status(401).json({ error: 'Token inválido' });

    req.user = user;
    next();
  } catch (error) {
    console.error('Erro na validação do token:', error);
    res.status(401).json({ error: 'Erro na autenticação' });
  }
};

module.exports = {
  supabase,
  validateToken,
};
