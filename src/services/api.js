import React, { useEffect, useState } from 'react';

function ConsultaNFe() {
  const [resultado, setResultado] = useState(null);

  const consultar = async () => {
    const token = localStorage.getItem('token');

    const res = await fetch('/api/sefaz/consulta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        certificadoId: 'seu-certificado-id',
        cnpjConsultado: '00.000.000/0001-00',
        tipoConsulta: 'simples',
        ambiente: 'homologacao',
      }),
    });

    const data = await res.json();
    setResultado(data);
  };

  return (
    <div>
      <button onClick={consultar}>Consultar XML</button>
      <pre>{JSON.stringify(resultado, null, 2)}</pre>
    </div>
  );
}
