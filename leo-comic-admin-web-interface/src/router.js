import { createRouter, createWebHistory } from 'vue-router'
import { currentUser, waitForAuthReady } from './auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
  {
    path: '/',
    name: 'stories',
    component: () => import('./views/StoriesListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/stories/new',
    name: 'story-new',
    component: () => import('./views/StoryDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/stories/:id',
    name: 'story-detail',
    component: () => import('./views/StoryDetailView.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: '/characters',
    name: 'characters',
    component: () => import('./views/CharactersListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/characters/new',
    name: 'character-new',
    component: () => import('./views/CharacterDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/characters/:id',
    name: 'character-detail',
    component: () => import('./views/CharacterDetailView.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: '/generate',
    name: 'generate-story',
    component: () => import('./views/GenerateStoryView.vue'),
    meta: { requiresAuth: true },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  await waitForAuthReady()
  if (to.meta.requiresAuth && !currentUser.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && currentUser.value) {
    return { name: 'stories' }
  }
  return true
})
