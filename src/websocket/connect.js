exports.handler = async (event) => {
  console.log('Connect handler called');
  
  return {
    statusCode: 200,
    body: 'Connected'
  };
};