export async function parsePDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function () {
      const text = new TextDecoder('utf-8').decode(new Uint8Array(this.result));
      resolve(text);
    };

    reader.onerror = function (error) {
      reject(error);
    };

    reader.readAsArrayBuffer(file);
  });
}
