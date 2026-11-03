const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGE_IMAGES = 3;
const MAX_HISTORY_IMAGE_CHARS = 6 * 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
function validImage(image) {
  return !!image && IMAGE_MIME_TYPES.includes(image.mimeType) && typeof image.data === 'string' &&
    image.data.length > 0 && image.data.length <= Math.ceil(MAX_IMAGE_BYTES / 3) * 4 &&
    image.data.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(image.data);
}
function validateImages(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_MESSAGE_IMAGES || !value.every(validImage)) throw new Error('INVALID_CHAT_IMAGES');
  return value.map(({ mimeType, data }) => ({ mimeType, data }));
}
function messageParts(text, images) {
  return [...(text ? [{ text }] : []), ...validateImages(images).map(image => ({ inlineData: image }))];
}
function imageUri(image) { return 'data:' + image.mimeType + ';base64,' + image.data; }
function hasChatImages(story) {
  const messagesHaveImages = messages => Array.isArray(messages) && messages.some(message => Array.isArray(message?.images) && message.images.length > 0);
  return story?.hasImageHistory === true || messagesHaveImages(story?.chatMessages) ||
    (Array.isArray(story?.episodes) && story.episodes.some(episode => messagesHaveImages(episode?.chatMessages)));
}
function checkImageBudget(messages, images = []) {
  const size = [...messages.flatMap(message => message.images ?? []), ...images].reduce((sum, image) => sum + image.data.length, 0);
  if (size > MAX_HISTORY_IMAGE_CHARS) throw new Error('CHAT_IMAGE_BUDGET');
}
module.exports = { MAX_IMAGE_BYTES, MAX_MESSAGE_IMAGES, MAX_HISTORY_IMAGE_CHARS, IMAGE_MIME_TYPES, validImage, validateImages, messageParts, imageUri, hasChatImages, checkImageBudget };
