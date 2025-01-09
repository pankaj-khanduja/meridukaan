module.exports = function(stringData, dataObject) {
  let keyArray = Object.keys(dataObject);
  let valueArray = Object.values(dataObject);

  let newString = stringData;
  keyArray.forEach(function(element, index) {
    let text = new RegExp("\\$" + element + "\\$", "g");
    newString = newString.replace(text, valueArray[index]);
  });
  return newString;
};
