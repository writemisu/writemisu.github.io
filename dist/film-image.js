const files=new Map();
export async function storeFilmImage(file){
 const image=await createImageBitmap(file);image.close();
 const id=crypto.randomUUID();files.set(id,file);return id;
}
export async function readFilmImage(id){
 const file=files.get(id);if(!file)throw Error('현재 탭에 배경 이미지가 없음');return createImageBitmap(file);
}
export function retainFilmImages(ids){
 for(const id of files.keys())if(!ids.has(id))files.delete(id);
}
