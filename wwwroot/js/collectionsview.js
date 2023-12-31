import { getJSON, showInfoDialog, showView, useLoadingSymbol, wait } from "./utils.js";
import { showDefinitionsTable } from "./definitionsview.js";
import { showCollectionDialog } from "./collectiondialog.js";

document.getElementById("collectionsView").onload = () => {
  showCollectionsTable();
};

document.getElementById("createCollection").onclick = document.getElementById(
  "newCollection"
).onclick = () => callShowCollectionDialog(null, false);

function callShowCollectionDialog(inputValues, isEditing) {
  showCollectionDialog(async (values) => {
    console.log(values);

    try {
      const collectionName = values.name;
      const collectionDescription = values.description;
      const collection = await useLoadingSymbol(async () => {
        if (isEditing) {
          return await getJSON(
            `/api/fusiondata/collections/${inputValues.id}`,
            "PUT",
            JSON.stringify({ collectionDescription })
          );
        } else {
          return await getJSON(
            `/api/fusiondata/collections`,
            "POST",
            JSON.stringify({ collectionName, collectionDescription })
          );
        }
      });

      wait(1);

      showCollectionsTable();
    } catch (error) {
      console.log(error);
      showInfoDialog("error", null, error, null, "OK", () => {
        callShowCollectionDialog(values, isEditing);
      });
    }
  }, inputValues, isEditing);  
}

function addRow(collectionsTable, collection) {
  let row = collectionsTable.insertRow();
  row.innerHTML += `<tr>
      <td><a class="collection-link" href="${collection.name}" collectionId="${collection.id}">${collection.name}</a></td>
      <td>${collection.description}</td>
      <td>
        <div class="dropdown">
          <a
            href="#"
            class="d-block link-body-emphasis text-decoration-none"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <span
              class="bi-three-dots-vertical"
              style="position: relative; left: -6px"
            ></span>
          </a>
          <ul class="dropdown-menu text-small">
            <li>
              <a class="dropdown-item add-property" href="#">Add Property Definition</a>
            </li>
            <li><hr class="dropdown-divider" /></li>
            <li>
              <a class="dropdown-item edit-collection" href="#">Edit Collection</a>
            </li>
          </ul>
        </div>
      </td>
    </tr>`;

  let link = row.querySelector(".collection-link");
  link.onclick = (event) => {
    console.log("onTableRowClick");

    const collectionId = link.getAttribute("collectionId");
    const collectionName = link.text;
    showDefinitionsTable(collectionId, collectionName);
  
    event.preventDefault();
  }

  let addProperty = row.querySelector(".add-property");
  addProperty.onclick = () => {
    console.log("onAddProperty");

    const collectionId = link.getAttribute("collectionId");
    const collectionName = link.text;
    showDefinitionsTable(collectionId, collectionName, true);
  };

  let editCollection = row.querySelector(".edit-collection");
  editCollection.onclick = () => {
    console.log("onEditCollection");

    callShowCollectionDialog(collection, true);
  };
}

export async function showCollectionsTable() {
  const collectionsTable = document.getElementById("collectionsTable");

  try {
    let collections = await useLoadingSymbol(async () => {
      return await getJSON(`/api/fusiondata/collections`, "GET");
    });

    if (collections.length < 1) {
      showView("emptyCollectionsView");
      return;
    }

    showView("collectionsView");
    collectionsTable.innerHTML = "";
    for (let collection of collections) {
      addRow(collectionsTable, collection);
    }
  } catch (error) {
    showInfoDialog("error", null, error, null, "OK");
  }
}
