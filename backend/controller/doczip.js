// controller/doczip.js
const { parseStringPromise, processors } = require('xml2js');
const zlib = require('zlib');

/**
 * Parseia o SOAP completo de Distribuição de DF‑e e retorna:
 * { cStat, ultNSU, maxNSU, docs: [ { nsu, xml }, ... ] }
 */
async function parseResponse(rawXml) {
  const js = await parseStringPromise(rawXml, {
    explicitArray: false,
    tagNameProcessors: [processors.stripPrefix],
  });

  const ret = js.Envelope.Body
    .nfeDistDFeInteresseResponse
    .nfeDistDFeInteresseResult
    .retDistDFeInt;

  const cStat = ret.cStat;
  const ultNSU = ret.ultNSU;
  const maxNSU = ret.maxNSU;
  const docs = [];

  if (ret.loteDistDFeInt && ret.loteDistDFeInt.docZip) {
    const arr = Array.isArray(ret.loteDistDFeInt.docZip)
      ? ret.loteDistDFeInt.docZip
      : [ret.loteDistDFeInt.docZip];

    for (const dz of arr) {
      const b64 = dz._;
      const buf = Buffer.from(b64, 'base64');
      const xml = zlib.gunzipSync(buf).toString('utf-8');
      docs.push({ nsu: dz.$.NSU, xml });
    }
  }

  return { cStat, ultNSU, maxNSU, docs };
}

module.exports = { parseResponse };
