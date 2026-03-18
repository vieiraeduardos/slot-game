export async function spin(){

    const res = await fetch("http://localhost:8080/spin")

    return res.json()
}