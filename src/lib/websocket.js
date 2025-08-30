const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

class WebSocketService {
  constructor(event) {
    this.domainName = event.requestContext.domainName;
    this.stage = event.requestContext.stage;
    this.endpoint = `https://${this.domainName}/${this.stage}`;
    
    this.apiGateway = new ApiGatewayManagementApiClient({
      endpoint: this.endpoint
    });
  }

  async sendToConnection(connectionId, data) {
    try {
      await this.apiGateway.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(data)
      }));
      return true;
    } catch (error) {
      console.error('Failed to send message to connection:', connectionId, error);
      return false;
    }
  }

  async broadcastToGame(connections, data) {
    const promises = connections.map(connectionId => 
      this.sendToConnection(connectionId, data)
    );
    
    await Promise.allSettled(promises);
  }
}

module.exports = WebSocketService;