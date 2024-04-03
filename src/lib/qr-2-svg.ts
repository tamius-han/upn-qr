import { Encoder} from '@nuintun/qrcode';

export function qr2Svg(qrData: string) {
  const qrcode = new Encoder()
  qrcode.setEncodingHint(true)
  qrcode.setErrorCorrectionLevel('H')
  qrcode.write(qrData);

  qrcode.make()
  console.log(qrcode)

  return createSvg(qrcode);
}

function createSvg(qrCode: any, cellSize?: number, margin?: number, alt?: number, title?: number) {
  cellSize = cellSize || 2;
  margin = (typeof margin == 'undefined') ? cellSize * 4 : margin;

  var size = (qrCode.matrixSize + margin) * 2;
  var c, mc, r, mr, qrSvg='', rect;

  rect = 'l' + cellSize + ',0 0,' + cellSize +
    ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

  qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
  qrSvg += '';
  qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
  qrSvg += ' preserveAspectRatio="xMinYMin meet"';
  qrSvg +=  '';
  qrSvg += '>';
  qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
  qrSvg += '<path d="';

  for (r = 0; r < qrCode.matrixSize; r += 1) {
    mr = r * cellSize + margin;
    for (c = 0; c < qrCode.matrixSize; c += 1) {
      if (qrCode.matrix[r][c]) {
        mc = c*cellSize+margin;
        qrSvg += 'M' + mc + ',' + mr + rect;
      }
    }
  }

  qrSvg += '" stroke="transparent" fill="black"/>';
  qrSvg += '</svg>';

  return qrSvg;
};
