<script setup>
import { RouterView, RouterLink, useRouter } from 'vue-router'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import { currentUser } from './auth'

const router = useRouter()

async function logout() {
  await signOut(auth)
  router.push({ name: 'login' })
}
</script>

<template>
  <header v-if="currentUser" class="app-header">
    <nav>
      <RouterLink to="/">Historias</RouterLink>
      <RouterLink to="/characters">Personajes</RouterLink>
      <RouterLink to="/generate">Generar historia</RouterLink>
    </nav>
    <button class="btn secondary" @click="logout">Salir</button>
  </header>
  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.app-header nav {
  display: flex;
  gap: 1.25rem;
}

.app-header nav a {
  text-decoration: none;
  font-weight: 600;
  color: var(--text);
}

.app-header nav a.router-link-active {
  color: var(--accent-dark);
}

.app-main {
  flex: 1;
  padding: 1.5rem;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}
</style>
