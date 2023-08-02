import { showView, showInfoDialog } from "./utils.js";

const _menuitemPropertiesView = document.getElementById("menuitemPropertiesView")
_menuitemPropertiesView.onclick = () => showView("propertiesView");

const _menuitemCollectionsView = document.getElementById("menuitemCollectionsView");
_menuitemCollectionsView.onclick = () => showView("collectionsView");

const _menuitemCredentialsView = document.getElementById("menuitemCredentialsView");
_menuitemCredentialsView.onclick = () => showView("credentialsView");

const _avatarImage = document.getElementById("avatarImage");
const _userName = document.getElementById("userName");

const _signInText = document.getElementById("signInText");

const _login = document.getElementById("signIn");
_login.onclick = () => window.location.replace("/api/auth/login");

const _logout = document.getElementById("signOut");
const _logoutDivider = document.getElementById("signOutDivider");
try {
  const credentialsResponse = await fetch("/api/auth/credentials");
  const credentials = await credentialsResponse.json();

  const callbackUrl = document.getElementById("callbackUrl");
  callbackUrl.src = callbackUrl.textContent = credentials.callbackUrl;
  const myAppsUrl = document.getElementById("myAppsUrl");
  myAppsUrl.href = `${credentials.apsUrl}/myapps/`;
  const accountsUrl = credentials.accountsUrl;

  if (!credentials.hasCredentials) {
    showView("credentialsView");
    throw "No credentials were provided"
  }
  
  if (!credentials.isValid) {
    showView("credentialsView");
    showInfoDialog('error', "Invalid Credentials", "Please verify that the provided credentials are correct", null, "Close");
    throw "Credentials are not valid"
  }

  _menuitemCollectionsView.classList.toggle('disabled', false);
  showView("collectionsView");

  const resp = await fetch("/api/auth/profile");
  if (resp.ok) {
    _menuitemPropertiesView.classList.toggle('disabled', false);

    const user = await resp.json();
    _userName.textContent = user.name;
    _avatarImage.src = user.picture;
    _userName.classList.toggle("hidden", false);

    _signInText.classList.toggle("hidden", true);
    _login.classList.toggle("hidden", true);
    _logout.classList.toggle("hidden", false);
    _logoutDivider.classList.toggle("hidden", false);
    _logout.onclick = () => {
      // Log the user out (see https://aps.autodesk.com/blog/log-out-forge)
      const iframe = document.createElement("iframe");
      iframe.style.visibility = "hidden";
      iframe.src = `${accountsUrl}/Authentication/LogOut`;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        window.location.replace("/api/auth/logout");
        document.body.removeChild(iframe);
      };
    };
  } else {
    throw "Could not get profile / 3-legged tokenn is not valid"
  }
} catch (err) {
  console.error(err);

  _signInText.classList.toggle("hidden", false);
  _userName.classList.toggle("hidden", true);
  _login.classList.toggle("hidden", false);
  _logout.classList.toggle("hidden", true);
  _logoutDivider.classList.toggle("hidden", true);
}
