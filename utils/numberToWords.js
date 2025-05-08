// Function to convert numbers to words (Indian numbering system)
exports.convertToWords = (number) => {
    const singleDigits = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const twoDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tenMultiples = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const tenPowers = ['', 'Thousand', 'Lakh', 'Crore'];
  
    if (number === 0) {
      return 'Zero Only';
    }
  
    let words = '';
    let num = Math.floor(number);
  
    // Function to convert numbers less than 1000
    function convertLessThanOneThousand(num) {
      let word = '';
  
      if (num % 100 < 10) {
        word = singleDigits[num % 100];
      } else if (num % 100 < 20) {
        word = twoDigits[num % 100 - 10];
      } else {
        word = tenMultiples[Math.floor((num % 100) / 10)];
        if (num % 10 !== 0) {
          word += ' ' + singleDigits[num % 10];
        }
      }
      
      return word;
    }
  
    // For Indian numbering system (Crore, Lakh, Thousand)
    let quotient = num;
    let idx = 0;
  
    // Handle crores (if any)
    let crores = Math.floor(quotient / 10000000);
    if (crores > 0) {
      words += convertLessThanOneThousand(crores) + ' Crore ';
      quotient = quotient % 10000000;
    }
  
    // Handle lakhs (if any)
    let lakhs = Math.floor(quotient / 100000);
    if (lakhs > 0) {
      words += convertLessThanOneThousand(lakhs) + ' Lakh ';
      quotient = quotient % 100000;
    }
  
    // Handle thousands (if any)
    let thousands = Math.floor(quotient / 1000);
    if (thousands > 0) {
      words += convertLessThanOneThousand(thousands) + ' Thousand ';
      quotient = quotient % 1000;
    }
  
    // Handle hundreds (if any)
    let hundreds = Math.floor(quotient / 100);
    if (hundreds > 0) {
      words += singleDigits[hundreds] + ' Hundred ';
      quotient = quotient % 100;
    }
  
    // Handle remaining two digits
    if (quotient > 0) {
      if (words !== '') {
        words += 'and ';
      }
      words += convertLessThanOneThousand(quotient);
    }
  
    return words + ' Only';
  };