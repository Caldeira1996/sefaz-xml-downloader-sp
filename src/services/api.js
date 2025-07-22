import React, { useState } from 'react';

function ConsultaNFe() {
  const [resultado, setResultado] = useState(null);

  const consultar = async () => {
    try {
      const res = await fetch('/api/sefaz/consulta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // REMOVIDO 'Authorization'
        },
        body: JSON.stringify({
          certificadoId: 'seu-certificado-id',
          cnpjConsultado: '00.000.000/0001-00',
          tipoConsulta: 'simples',
          ambiente: 'homologacao',
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro na consulta: ${res.status}`);
      }

      const data = await res.json();
      setResultado(data);
    } catch (error) {
      setResultado({ error: error.message });
    }
  };

  return (
    <div>
      <button onClick={consultar}>Consultar XML</button>
      <pre>{JSON.stringify(resultado, null, 2)}</pre>
    </div>
  );
}

export default ConsultaNFe;
