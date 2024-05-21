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
        componentVersion(componentVersionId: $componentVersionId) {
          id
          thumbnail {
            status
            signedUrl
          }
        }
      }`,
      {
        componentVersionId
      }
    )

    let thumbnail = response.data.data.componentVersion.thumbnail;

    return thumbnail;
  }

  async getDrawingVersionThumbnailUrl(drawingVersionId) {  
    let response = await this.sendQuery(
      `query GetThumbnail($drawingVersionId: ID!) {
        drawingVersion(drawingVersionId: $drawingVersionId) {
          id
          thumbnail {
            status
            signedUrl
          }
        }
      }`,
      {
        drawingVersionId
      }
    )

    let thumbnail = response.data.data.drawingVersion.thumbnail;

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
            ... on DesignItemVersion {
              rootComponentVersion {
                id
                thumbnail {
                  status
                  signedUrl
                }
              }
            }
            ... on DrawingItemVersion {
              drawingVersion {
                id
                thumbnail {
                  status
                  signedUrl
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
            ... on DesignItemVersion {
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
            ... on DrawingItemVersion {
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
            ... on DesignItem {
              rootComponent {
                id
              }
            }
            ... on DrawingItem {
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
          application {
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
      cursor = response?.data?.data?.application?.propertyDefinitionCollections?.pagination?.cursor;
      console.log({cursor});
      cursor = null;
      res = res.concat(response.data.data.application.propertyDefinitionCollections.results);
    } while (cursor)
    return res;
  }

  async getCollectionsByHubId(hubId, isMinimal) { 
    let res = [];
    let cursor = null;
    do {
      let response = await this.sendQuery(
        `query GetPropertyDefinitionCollectionsByHub ($hubId: ID!) {
          nav {
            hub(hubId: $hubId) {
              propertyDefinitionCollections ${cursor ? `(pagination : { cursor: "${cursor})" }` : `${isMinimal ? '(pagination : { limit: 1 })' : ''}`} {
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
          }
        }`,
        {
          hubId
        }
      )
      cursor = response?.data?.data?.nav?.hub?.propertyDefinitionCollections?.pagination?.cursor;
      console.log({cursor});
      cursor = null;

      res = res.concat(response.data.data.nav.hub.propertyDefinitionCollections.results);
    } while (cursor)

    return res;
  }

  async linkCollectionToHub(hubId, collectionId) { 
    let response = await this.sendQuery(
      `mutation LinkPropertyDefinitionCollection(
        $propertyDefinitionCollectionId: ID!, $hubId: ID!
      ) {
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
      }`,
      {
        propertyDefinitionCollectionId: collectionId,
        hubId: hubId
      }
    )
      
    return response.data.data.linkPropertyDefinitionCollection.hub.id;  
  }

  async unlinkCollectionFromHub(hubId, collectionId) { 
    let response = await this.sendQuery(
      `mutation UnlinkPropertyDefinitionCollection($propertyDefinitionCollectionId: ID!, $targetHubId: ID!) {
        unlinkPropertyDefinitionCollection(input: {propertyDefinitionCollectionId: $propertyDefinitionCollectionId, hubId: $targetHubId}) {
          propertyDefinitionCollectionId
          hub {
            id
            name
          } 
        }
      }`,
      {
        targetHubId: hubId,
        propertyDefinitionCollectionId: collectionId
      }
    )
      
    return response.data.data.unlinkPropertyDefinitionCollection.hub.id;  
  }

  async createCollection(name, collectionDescription) { 
      let response = await this.sendQuery(
        `mutation CreatePropertyDefinitionCollection($name: String!, $description: String!) {
          createPropertyDefinitionCollection(
            input: {name: $name, description: $description}
          ) {
            propertyDefinitionCollection {
              id
              name
              description
            }
          }
        }`,
        {
          name: name,
          description: collectionDescription
        }
      );
      

    return response.data.data.createPropertyDefinitionCollection.propertyDefinitionCollection;
  }

  async updateCollection(collectionId, collectionDescription) { 
    let response = await this.sendQuery(
      `mutation UpdatePropertyDefinitionCollection($propertyDefinitionCollectionId: ID!, $description: String!) {
        updatePropertyDefinitionCollection(
          input: {propertyDefinitionCollectionId: $propertyDefinitionCollectionId, description: $description}
        ) {
          propertyDefinitionCollection {
            id
            name
            description
          }
        }
      }`,
      {
        propertyDefinitionCollectionId: collectionId,
        description: collectionDescription
      }
    );

    return response.data.data.updatePropertyDefinitionCollection.propertyDefinitionCollection;
  }

  async getDefinitions(collectionId) { 
    let res = [];
    let cursor = null;
    do {
      let response = await this.sendQuery(
        `query GetPropertyDefinitions($propertyDefinitionCollectionId: ID!) {
          application {
            propertyDefinitionCollections(filter: {id: [$propertyDefinitionCollectionId]}) {
              results {
                definitions ${cursor ? `(pagination : { cursor: "${cursor}" })` : "" } {
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
            }
          }
        }`,
        {
          propertyDefinitionCollectionId: collectionId
        }
      )
      cursor = response?.data?.data?.application?.propertyDefinitionCollections?.results[0]?.definitions?.pagination?.cursor;
      console.log({cursor});
      cursor = null;

      res = res.concat(response.data.data.application.propertyDefinitionCollections.results[0].definitions.results);
    } while (cursor)

    return res;
  }

  async createDefinition(collectionId, name, specification, description, isHidden, shouldCopy, isReadOnly, propertyBehavior) { 

    let response = await this.sendQuery(
      `mutation CreatePropertyDefinition($propertyDefinitionCollectionId: ID!, $propertyDefinitionName: String!, $propertySpecification: String!, $description: String!, $isHidden: Boolean!, $shouldCopy: Boolean!, $isReadOnly: Boolean!, $propertyBehavior: PropertyBehaviorEnum!) {
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
    
    return response.data.data.createPropertyDefinition.propertyDefinition;
  }

  //TODO: This query is deprecated, now we need to use the hub -> propertyDefinitionCollections query with definition ID in the filter
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
      }`,
      {
        propertyDefinitionId: definitionId,
        description: description,
        isHidden: isHidden
      }
    );
    
    return response.data.data.updatePropertyDefinition.propertyDefinition;
  }

  async archiveDefinition(definitionId) { 

    let response = await this.sendQuery(
      `mutation UpdatePropertyDefinition($propertyDefinitionId: ID!) {
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
      }`,
      {
        propertyDefinitionId: definitionId
      }
    );
    
    return response.data.data.archivePropertyDefinition.propertyDefinition;
  }

  async getGeneralPropertiesForComponentVersion(versionId) {  
    let response = await this.sendQuery(
      `query GetProperties($componentVersionId: ID!) {
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
      }`,
      {
        componentVersionId: versionId
      }
    )

    return response.data.data.componentVersion;
  }

  async getGeneralPropertiesForDrawingVersion(versionId) {  
    let response = await this.sendQuery(
      `query GetProperties($drawingVersionId: ID!) {
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
      }`,
      {
        drawingVersionId: versionId
      }
    )

    return response.data.data.drawingVersion;
  }

  async getPropertiesForComponentVersion(componentVersionId) {  
    let response = await this.sendQuery(
      `query GetAllProperties($componentVersionId: ID!) {
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
      }`,
      {
        componentVersionId
      }
    )

    return response.data.data.componentVersion.customProperties.results;
  }

  async getPropertiesForDrawingVersion(drawingVersionId) {  
    let response = await this.sendQuery(
      `query GetAllProperties($drawingVersionId: ID!) {
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
      }`,
      {
        drawingVersionId
      }
    )

    return response.data.data.drawingVersion.customProperties.results;
  }

  async setProperties(extendableId, properties) {  
    let response = await this.sendQuery(
      `mutation SetProperties($input: SetPropertiesInput!) {
        setProperties(input: $input) {
          targetId
        }
      }`,
      {
        input: {
          extendableId,
          propertyInputs: properties
        }
      }
    )

    return response.data.data.setProperties;
  }

  // TODO: Need to re-write this mutation since it is deprecated. Now we need to use setProperties mutation with shouldClear input set to true
  async deleteProperty(extendableId, propertyDefinitionId) {  
    let response = await this.sendQuery(
      `mutation DeleteProperty($extendableId: ID!, $propertyDefinitionId: ID!) {
        clearProperties(input: {extendableId: $extendableId, propertyDefinitionIds: [$propertyDefinitionId]}) {
          extendableId
        }
      }`,
      {
        extendableId,
        propertyDefinitionId
      }
    )

    return response.data.data.deleteProperty;
  }

  async getModelOccurrences(componentVersionId) {
    let cursor = null;
    let result = []; 
    while (true) {
      let response = await this.sendQuery(
        `query GetModelOccurrences($componentVersionId: ID!${cursor ? ', $cursor: String!' : ''}) {
          componentVersion(componentVersionId: $componentVersionId) {
            occurrences${cursor ? '(pagination: {cursor: $cursor})' : ''} {
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
        }`,
        {
          componentVersionId,
          cursor
        }
      )

      result = result.concat(response.data.data.componentVersion.occurrences.results);

      cursor = response.data.data.mfg.componentVersion.occurrences.pagination.cursor;
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
          componentVersion(componentVersionId: $componentVersionId) {
            allOccurrences${cursor ? '(pagination: {cursor: $cursor})' : ''} {
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
        }`,
        {
          componentVersionId,
          cursor
        }
      )

      result = result.concat(response.data.data.componentVersion.allOccurrences.results);

      cursor = response.data.data.mfg.componentVersion.allOccurrences.pagination.cursor;
      if (!cursor)
        break;
    }

    return result;
  }
}

module.exports = App;
