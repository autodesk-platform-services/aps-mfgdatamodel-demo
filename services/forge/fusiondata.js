// Axios is a promise-based HTTP client for the browser and node.js. 
const axios = require("axios");
const { GRAPHQL_URL } = require('../../config.js');

// Application constructor 
class App {
  constructor(accessToken) {
    this.graphAPI = GRAPHQL_URL;
    this.accessToken = accessToken;
    console.log(accessToken);
  }

  getRequestHeaders() {
    return {
      "Content-type": "application/json",
      "Authorization": "Bearer " + this.accessToken,
    };
  }

  async sendQuery(query, variables) {
    let response = null;

    try {
      response = await axios({
        method: 'POST',
        url: `${this.graphAPI}`,
        headers: this.getRequestHeaders(),
        data: { 
          query,
          variables
        }
      })
    } catch (err) {
      response = err.response;
    }

    if (response.data.errors && !query.includes('GetPropertyDefinitionCollectionsByHub')) {
      let formatted = JSON.stringify(response.data.errors, null, 2);
      console.log(`API error:\n${formatted}`);

      throw this.getErrorMessage(response.data.errors);
    }
    
    return response;
  }

  getErrorMessage(errors) {
    const error = errors[0]
    let message = error.message.split("message=")[1]

    if (message)
      return message; 

    message = error.message;

    return message;
  }

  async getComponentVersionThumbnailUrl(componentVersionId) {  
    let response = await this.sendQuery(
      `query GetThumbnail($componentVersionId: ID!) {
        mfg {
          componentVersion(componentVersionId: $componentVersionId) {
            id
            thumbnail {
              status
              url
            }
          }
        }
      }`,
      {
        componentVersionId
      }
    )

    let thumbnail = response.data.data.mfg.componentVersion.thumbnail;

    return thumbnail;
  }

  async getDrawingVersionThumbnailUrl(drawingVersionId) {  
    let response = await this.sendQuery(
      `query GetThumbnail($drawingVersionId: ID!) {
        mfg {
          drawingVersion(drawingVersionId: $drawingVersionId) {
            id
            thumbnail {
              status
              url
            }
          }
        }
      }`,
      {
        drawingVersionId
      }
    )

    let thumbnail = response.data.data.mfg.drawingVersion.thumbnail;

    return thumbnail;
  }

  async getThumbnailForUrl(thumbnailUrl) {  
    let resp = await axios({
      method: 'GET',
      url: thumbnailUrl,
      headers: this.getRequestHeaders(),
      responseType: 'arraybuffer',
      responseEncoding: 'binary'
    })

    return resp.data;
  }

  async getThumbnail(projectId, fileVersionId) {  
    let response = await this.sendQuery(
      `query GetThumbnail($projectId: ID!, $fileVersionId: ID!) {
        nav {
          itemVersion(projectId: $projectId, versionId: $fileVersionId) {
            ... on MFGDesignItemVersion {
              rootComponentVersion {
                id
                thumbnail {
                  status
                  url
                }
              }
            }
            ... on MFGDrawingItemVersion {
              drawingVersion {
                id
                thumbnail {
                  status
                  url
                }
              }
            }
          }
        }
      }`,
      {
        projectId,
        fileVersionId
      }
    )

    let itemVersion = response.data.data.nav.itemVersion;
    let thumbnail = itemVersion.rootComponentVersion ? itemVersion.rootComponentVersion.thumbnail : itemVersion.drawingVersion.thumbnail;
    let id = itemVersion.rootComponentVersion ? itemVersion.rootComponentVersion.id : itemVersion.drawingVersion.id;

    let resp = await axios({
      method: 'GET',
      url: thumbnail.url,
      headers: this.getRequestHeaders(),
      responseType: 'arraybuffer',
      responseEncoding: 'binary'
    })

    return resp.data;
  }

  async getVersionId(projectId, fileVersionId) {  
    let response = await this.sendQuery(
      `query GetVersionId($projectId: ID!, $fileVersionId: ID!) {
        nav {
          itemVersion(projectId: $projectId, versionId: $fileVersionId) {
            ... on MFGDesignItemVersion {
              rootComponentVersion {
                id
                lastModifiedOn
                component {
                  id
                  tipVersion {
                    id
                  }
                }
              }
            }
            ... on MFGDrawingItemVersion {
              drawingVersion {
                id
                lastModifiedOn
                drawing {
                  id
                  tipVersion {
                    id
                  }
                }
              }
            }
          }
        }
      }`,
      {
        projectId,
        fileVersionId
      }
    )

    const itemVersion = response.data.data.nav.itemVersion;
    const versionId = itemVersion.rootComponentVersion ? itemVersion.rootComponentVersion.id : itemVersion.drawingVersion.id;
    const tipVersionId = itemVersion.rootComponentVersion ? itemVersion.rootComponentVersion.component.tipVersion.id : itemVersion.drawingVersion.drawing.tipVersion.id;
    const itemId = itemVersion.rootComponentVersion ? itemVersion.rootComponentVersion.component.id : itemVersion.drawingVersion.drawing.id;
    const lastModifiedOn = itemVersion.rootComponentVersion ? itemVersion.rootComponentVersion.lastModifiedOn : itemVersion.drawingVersion.lastModifiedOn;
    const type = itemVersion.rootComponentVersion ? 'component' : 'drawing';

    return { itemId, versionId, tipVersionId, lastModifiedOn, type };
  }

  async getItemId(projectId, fileItemId) {  
    let response = await this.sendQuery(
      `query GetItemId($projectId: ID!, $fileItemId: ID!) {
        nav {
          item(projectId: $projectId, itemId: $fileItemId) {
            ... on MFGDesignItem {
              rootComponent {
                id
              }
            }
            ... on MFGDrawingItem {
              drawing {
                id
              }
            }
          }
        }
      }`,
      {
        projectId,
        fileItemId
      }
    )

    const item = response.data.data.nav.item;
    const id = item.rootComponent ? item.rootComponent.id : item.drawing.id;
    const type = item.rootComponent ? 'component' : 'drawing';

    return { id, type };
  }

  async getCollections() { 
    let res = [];
    let cursor = null;
    do {
      let response = await this.sendQuery(
        `query GetPropertyDefinitionCollections {
          mfg {
            propertyDefinitionCollections ${cursor ? `(pagination : { cursor: "${cursor}" })` : "" } {
              pagination {
                cursor
                pageSize
              }
              results {
                id
                name
                description
              }
            }
          }
        }`,
        {
        }
      )
      cursor = response?.data?.data?.mfg?.propertyDefinitionCollections?.pagination?.cursor;
      console.log({cursor});
      cursor = null;

      res = res.concat(response.data.data.mfg.propertyDefinitionCollections.results);
    } while (cursor)

    return res;
  }

  async getCollectionsByHubId(hubId, isMinimal) { 
    let res = [];
    let cursor = null;
    do {
      let response = await this.sendQuery(
        `query GetPropertyDefinitionCollectionsByHub ($hubId: ID!) {
          mfg {
            propertyDefinitionCollectionsByHub (hubId: $hubId${cursor ? `, pagination : { cursor: "${cursor}" }` : `${isMinimal ? ', pagination : { limit: 1 }' : ''}` }) {
              pagination {
                cursor
                pageSize
              }
              results {
                id
                name
                definitions {
                  results {
                    id
                    name
                    propertyBehavior
                    isArchived
                    isReadOnly
                    specification
                    units {
                      name
                    }
                  }
                }
              }
            }
          }
        }`,
        {
          hubId
        }
      )
      cursor = response?.data?.data?.mfg?.propertyDefinitionCollectionsByHub?.pagination?.cursor;
      console.log({cursor});
      cursor = null;

      res = res.concat(response.data.data.mfg.propertyDefinitionCollectionsByHub.results);
    } while (cursor)

    return res;
  }

  async linkCollectionToHub(hubId, collectionId) { 
    let response = await this.sendQuery(
      `mutation LinkPropertyDefinitionCollection(
        $propertyDefinitionCollectionId: ID!, $hubId: ID!
      ) {
        mfg {
          linkPropertyDefinitionCollection(
            input: {
              propertyDefinitionCollectionId: $propertyDefinitionCollectionId,
              hubId: $hubId
            }
          ) {
            hub {
              id
              name
            }
          }
        }
      }`,
      {
        propertyDefinitionCollectionId: collectionId,
        hubId: hubId
      }
    )
      
    return response.data.data.mfg.linkPropertyDefinitionCollection.hub.id;  
  }

  async unlinkCollectionFromHub(hubId, collectionId) { 
    let response = await this.sendQuery(
      `mutation UnlinkPropertyDefinitionCollection($propertyDefinitionCollectionId: ID!, $targetHubId: ID!) {
        mfg {
          unlinkPropertyDefinitionCollection(
            input: {propertyDefinitionCollectionId: $propertyDefinitionCollectionId, hubId: $targetHubId}
          ) {
            propertyDefinitionCollectionId
            hub {
              id
              name
            } 
          }
        }
      }`,
      {
        targetHubId: hubId,
        propertyDefinitionCollectionId: collectionId
      }
    )
      
    return response.data.data.mfg.unlinkPropertyDefinitionCollection.hub.id;  
  }

  async createCollection(name, collectionDescription) { 
      let response = await this.sendQuery(
        `mutation CreatePropertyDefinitionCollection($name: String!, $description: String!) {
          mfg {
            createPropertyDefinitionCollection(
              input: {name: $name, description: $description}
            ) {
              propertyDefinitionCollection {
                id
                name
                description
              }
            }
          }
        }`,
        {
          name: name,
          description: collectionDescription
        }
      );
      

    return response.data.data.mfg.createPropertyDefinitionCollection.propertyDefinitionCollection;
  }

  async updateCollection(collectionId, collectionDescription) { 
    let response = await this.sendQuery(
      `mutation UpdatePropertyDefinitionCollection($propertyDefinitionCollectionId: ID!, $description: String!) {
        mfg {
          updatePropertyDefinitionCollection(
            input: {propertyDefinitionCollectionId: $propertyDefinitionCollectionId, description: $description}
          ) {
            propertyDefinitionCollection {
              id
              name
              description
            }
          }
        }
      }`,
      {
        propertyDefinitionCollectionId: collectionId,
        description: collectionDescription
      }
    );

    return response.data.data.mfg.updatePropertyDefinitionCollection.propertyDefinitionCollection;
  }

  async getDefinitions(collectionId) { 
    let res = [];
    let cursor = null;
    do {
      let response = await this.sendQuery(
        `query GetPropertyDefinitions($propertyDefinitionCollectionId: ID!) {
          mfg {
            propertyDefinitions(
              propertyDefinitionCollectionId: $propertyDefinitionCollectionId
            ) {
              pagination {
                cursor
                pageSize
              }
              results {
                id
                name
                specification
                units {
                  id
                  name
                }
                isArchived
                isHidden
                shouldCopy
                isReadOnly
                description
                propertyBehavior
              }
            }
          }
        }`,
        {
          propertyDefinitionCollectionId: collectionId
        }
      )
      cursor = response?.data?.data?.mfg?.propertyDefinitions?.pagination?.cursor;
      console.log({cursor});
      cursor = null;

      res = res.concat(response.data.data.mfg.propertyDefinitions.results);
    } while (cursor)

    return res;
  }

  async createDefinition(collectionId, name, specification, description, isHidden, shouldCopy, isReadOnly, propertyBehavior) { 

    let response = await this.sendQuery(
      `mutation CreatePropertyDefinition($propertyDefinitionCollectionId: ID!, $propertyDefinitionName: String!, $propertySpecification: String!, $description: String!, $isHidden: Boolean!, $shouldCopy: Boolean!, $isReadOnly: Boolean!, $propertyBehavior: PropertyBehaviorEnum!) {
        mfg {
          createPropertyDefinition(
            input: {propertyDefinitionCollectionId: $propertyDefinitionCollectionId, name: $propertyDefinitionName, specification: $propertySpecification, description: $description, isHidden: $isHidden, shouldCopy: $shouldCopy, isReadOnly: $isReadOnly, propertyBehavior: $propertyBehavior}
          ) {
            propertyDefinition {
              id
              name
              specification
              units {
                id
                name
              }
              isArchived
              isHidden
              shouldCopy
              isReadOnly
              description
              propertyBehavior
            }
          }
        }
      }`,
      {
        propertyDefinitionCollectionId: collectionId,
        propertyDefinitionName: name,
        propertySpecification: specification,
        description: description,
        isHidden: isHidden,
        isReadOnly: isReadOnly,
        shouldCopy: shouldCopy,

        propertyBehavior: propertyBehavior
      }
    );
    
    return response.data.data.mfg.createPropertyDefinition.propertyDefinition;
  }

  async getDefinition(definitionId) { 

    let response = await this.sendQuery(
      `query GetPropertyDefinition($propertyDefinitionId: ID!) {
        mfg {
          propertyDefinition(propertyDefinitionId: $propertyDefinitionId) {
            id
            name
            specification
            units {
              id
              name
            }
            isArchived
            isHidden
            shouldCopy
            isReadOnly
            description
            propertyBehavior
          }
        }
      }`,
      {
        propertyDefinitionId: definitionId
      }
    );
    
    return response.data.data.mfg.propertyDefinition;
  }

  async updateDefinition(definitionId, description, isHidden) { 

    let response = await this.sendQuery(
      `mutation UpdatePropertyDefinition($propertyDefinitionId: ID!, $description: String!, $isHidden: Boolean!) {
        mfg {
          updatePropertyDefinition(
            input: {propertyDefinitionId: $propertyDefinitionId, description: $description, isHidden: $isHidden}
          ) {
            propertyDefinition {
              id
              name
              specification
              units {
                id
                name
              }
              isArchived
              isHidden
              shouldCopy
              isReadOnly
              description
              propertyBehavior
            }
          }
        }
      }`,
      {
        propertyDefinitionId: definitionId,
        description: description,
        isHidden: isHidden
      }
    );
    
    return response.data.data.mfg.updatePropertyDefinition.propertyDefinition;
  }

  async archiveDefinition(definitionId) { 

    let response = await this.sendQuery(
      `mutation UpdatePropertyDefinition($propertyDefinitionId: ID!) {
        mfg {
          archivePropertyDefinition(
            input: {propertyDefinitionId: $propertyDefinitionId}
          ) {
            propertyDefinition {
              id
              name
              specification
              units {
                id
                name
              }
              isArchived
              isHidden
              shouldCopy
              isReadOnly
              description
              propertyBehavior
            }
          }
        }
      }`,
      {
        propertyDefinitionId: definitionId
      }
    );
    
    return response.data.data.mfg.archivePropertyDefinition.propertyDefinition;
  }

  async getGeneralPropertiesForComponentVersion(versionId) {  
    let response = await this.sendQuery(
      `query GetProperties($componentVersionId: ID!) {
        mfg {
          componentVersion(componentVersionId: $componentVersionId) {
            lastModifiedOn

            partNumber
            name
            partDescription
            materialName

            manage {
              itemNumber
              lifeCycle
              revision
              changeOrder
              changeOrderURN
            }

            physicalProperties {
              mass {
                value
                definition {
                  units {
                    name
                  }
                }
              }
              volume {
                value
                definition {
                  units {
                    name
                  }
                }
              }
              density {
                value
                definition {
                  units {
                    name
                  }
                }
              }
              area {
                value
                definition {
                  units {
                    name
                  }
                }
              }
              boundingBox {
                length {
                  value
                  definition {
                    units {
                      name
                    }
                  }
                }
                width {
                  value
                  definition {
                    units {
                      name
                    }
                  }
                }
                height {
                  value
                  definition {
                    units {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      {
        componentVersionId: versionId
      }
    )

    return response.data.data.mfg.componentVersion;
  }

  async getGeneralPropertiesForDrawingVersion(versionId) {  
    let response = await this.sendQuery(
      `query GetProperties($drawingVersionId: ID!) {
        mfg {
          drawingVersion(drawingVersionId: $drawingVersionId) {
            lastModifiedOn

            partNumber
            name
            partDescription

            manage {
              itemNumber
              lifeCycle
              revision
              changeOrder
              changeOrderURN
            }
          }
        }
      }`,
      {
        drawingVersionId: versionId
      }
    )

    return response.data.data.mfg.drawingVersion;
  }

  async getPropertiesForComponentVersion(componentVersionId) {  
    let response = await this.sendQuery(
      `query GetAllProperties($componentVersionId: ID!) {
        mfg {
          componentVersion(componentVersionId: $componentVersionId) {
            customProperties {
              results {
                value
                definition {
                  id
                  name
                  specification
                  isHidden
                  shouldCopy
                  description
                  propertyBehavior
                  units {
                    name
                  }
                }
              }
            }
          }
        }
      }`,
      {
        componentVersionId
      }
    )

    return response.data.data.mfg.componentVersion.customProperties.results;
  }

  async getPropertiesForDrawingVersion(drawingVersionId) {  
    let response = await this.sendQuery(
      `query GetAllProperties($drawingVersionId: ID!) {
        mfg {
          drawingVersion(drawingVersionId: $drawingVersionId) {
            customProperties {
              results {
                value
                definition {
                  id
                  name
                  specification
                  isHidden
                  shouldCopy
                  description
                  propertyBehavior
                  units {
                    name
                  }
                }
              }
            }
          }
        }
      }`,
      {
        drawingVersionId
      }
    )

    return response.data.data.mfg.drawingVersion.customProperties.results;
  }

  async setProperties(extendableId, properties) {  
    let response = await this.sendQuery(
      `mutation SetProperties($input: SetPropertiesInput!) {
        mfg {
          setProperties(input: $input) {
            extendableId
          }
        }
      }`,
      {
        input: {
          extendableId,
          propertyInputs: properties
        }
      }
    )

    return response.data.data.mfg.setProperties;
  }

  async deleteProperty(extendableId, propertyDefinitionId) {  
    let response = await this.sendQuery(
      `mutation DeleteProperty($extendableId: ID!, $propertyDefinitionId: ID!) {
        mfg {
          clearProperties(input: {extendableId: $extendableId, propertyDefinitionIds: [$propertyDefinitionId]}) {
            extendableId
          }
        }
      }`,
      {
        extendableId,
        propertyDefinitionId
      }
    )

    return response.data.data.mfg.deleteProperty;
  }

  async getModelOccurrences(componentVersionId) {
    let cursor = null;
    let result = []; 
    while (true) {
      let response = await this.sendQuery(
        `query GetModelOccurrences($componentVersionId: ID!${cursor ? ', $cursor: String!' : ''}) {
          mfg {
            componentVersion(componentVersionId: $componentVersionId) {
              modelOccurrences${cursor ? '(pagination: {cursor: $cursor})' : ''} {
                results {
                  componentVersion {
                    id
                    name
                    lastModifiedOn
                    component {
                      id
                      tipVersion {
                        id
                      }
                    }
                  }
                }
                pagination {
                  cursor
                }
              }
            }
          }
        }`,
        {
          componentVersionId,
          cursor
        }
      )

      result = result.concat(response.data.data.mfg.componentVersion.modelOccurrences.results);

      cursor = response.data.data.mfg.componentVersion.modelOccurrences.pagination.cursor;
      if (!cursor)
        break;
    }

    return result;
  }

  async getAllModelOccurrences(componentVersionId) {
    let cursor = null;
    let result = []; 
    while (true) {
      let response = await this.sendQuery(
        `query GetAllModelOccurrences($componentVersionId: ID!${cursor ? ', $cursor: String!' : ''}) {
          mfg {
            componentVersion(componentVersionId: $componentVersionId) {
              allModelOccurrences${cursor ? '(pagination: {cursor: $cursor})' : ''} {
                results {
                  parentComponentVersion {
                    id 
                  }
                  componentVersion {
                    id
                    name
                    partNumber
                    materialName
                    component {
                      id
                    }
                  }
                }
                pagination {
                  cursor
                }
              }
            }
          }
        }`,
        {
          componentVersionId,
          cursor
        }
      )

      result = result.concat(response.data.data.mfg.componentVersion.allModelOccurrences.results);

      cursor = response.data.data.mfg.componentVersion.allModelOccurrences.pagination.cursor;
      if (!cursor)
        break;
    }

    return result;
  }
}

module.exports = App;
