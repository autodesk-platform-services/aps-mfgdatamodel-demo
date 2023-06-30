import { getJSON, useLoadingSymbol } from './utils.js';

export async function showHubCollectionsDialog(hubId) {
  const collectionsDialogEmpty =  document.getElementById('collectionsDialogEmpty');
  collectionsDialogEmpty.classList.remove("hidden");

  const dialogButton =  document.getElementById('collectionsDialogButton');
  dialogButton.click();

  // Fill the list
  const collectionsList =  document.getElementById('collectionsList');
  collectionsList.innerHTML = '';

  let [collections, linkedCollections] = await useLoadingSymbol(async () => {
    return await Promise.allSettled([
      getJSON(`/api/fusiondata/collections`, 'GET'),
      getJSON(`/api/fusiondata/${hubId}/collections`)
    ])
  });

  // If getting lkinked collections failed (linkedCollections.status='rejected')
  // you have no admin access to that hub

  if (collections.value?.length < 1 || !linkedCollections.value) 
    return;

  const isLinked = (collectionId) => {
    const result = linkedCollections.value.find((item) => item.id === collectionId)

    return !!result; 
  }

  collectionsDialogEmpty.classList.add("hidden");

  for (let collection of collections.value) {
    const linkIcon = 
      isLinked(collection.id) ? 
        `<span class="bi-link-45deg float-right clickable"></span>` : 
        `<span class="bi-link-45deg float-right clickable dimmed"></span>` ;
    collectionsList.innerHTML += `<li class="list-group-item" collectionId="${collection.id}">${collection.name}${linkIcon}</li>`
  }

  for (let item of collectionsList.getElementsByClassName("bi-link-45deg")) {
    item.onclick = (async event => {
      if (!item.classList.contains("dimmed"))
        return;

      const collectionId = event.target.parentElement.getAttribute("collectionId");
      try {
        let result = await getJSON(`/api/fusiondata/${hubId}/collections`, 'POST', JSON.stringify({ collectionId }));
        item.classList.remove("dimmed");
      } catch (error) {
        console.log(error);
      }
    })
  }
}
