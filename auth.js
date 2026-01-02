// auth.js

import { supabase } from "./supabase.js";

const email = document.getElementById("email");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const successMsg = document.getElementById("successMessage");
const errorMsg = document.getElementById("errorMessage");

function showSuccess(msg) {
  successMsg.textContent = msg;
  successMsg.className = "show-message";
  errorMsg.className = "";
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.className = "show-message";
  successMsg.className = "";
}

loginBtn.onclick = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value.trim()
  });

  if (error) showError(error.message);
  else showSuccess("Logged in successfully");
};

signupBtn.onclick = async () => {
  const { error } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: password.value.trim()
  });

  if (error) showError(error.message);
  else showSuccess("Check your email to confirm signup");
};
