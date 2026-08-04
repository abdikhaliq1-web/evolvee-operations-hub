const sample = require('../sampleData/zohoBooks.json');

// Obtaining a summary of the companies fincaials.
async function getSummary(){
    return sample.summary;
}

// Will return details about each product including their profit and profit margin.
async function getProducts(){
    return sample.products;
}

module.exports = {
    getSummary,
    getProducts
};