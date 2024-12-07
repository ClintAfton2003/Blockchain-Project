import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useEth } from "../../contexts/EthContext";
import { PinataSDK } from "pinata";

const pinataApiKey = "3ad2836b65aadcf6a33e";
const pinataSecretApiKey = "dfc684dae4450c07be901c24a4717592bcca0d814c2a18e3c0c5d39e479ffbf3";
const pinataSecretJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIwZDNhZTc1YS04ZTkyLTRjNDctOTVmYy01NjlmN2VmMmYwNjAiLCJlbWFpbCI6InRhY29uZ3RoYW5odG9hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiMTM5MjRhYjZhZjJiNGZhYjQ1YjciLCJzY29wZWRLZXlTZWNyZXQiOiIwYWRhMzNiOWMyMWE4ZDUxYWU0ZmMyMTM0NDk3MDg3NzFhOTcwYzkxMzgwMTU5MjgzMDdlOGU4MDhkMDU1OGM3IiwiZXhwIjoxNzYxMjc4MzkzfQ.p3rbphBxhUzY4nI2qVsEKd8FOP7SEzizvyqFOKfwCXU";

const ITEM_STATE = {
    Created: "0",
    Paid: "1",
    Delivered: "2",
};

export function Marketplace(props) {
    const {
        state: { accounts, contract },
    } = useEth();

    const [newItemName, setNewItemName] = useState("");
    const [newItemPrice, setNewItemPrice] = useState("");
    const [listItem, setListItem] = useState([]);
    const [newItemImage, setNewItemImage] = useState(null);
    const [error, setError] = useState("");
    const [showHidden, setShowHidden] = useState(false);
    const [searchTerm, setSearchTerm] = useState(""); // New state for search term

    const handleImageUpload = async () => {
        const formData = new FormData();
        formData.append("file", newItemImage); // Add the image file to form data

        const pinataUrl = "https://api.pinata.cloud/pinning/pinFileToIPFS";

        const metadata = JSON.stringify({ name: newItemImage.name });

        formData.append("pinataMetadata", metadata);

        try {
            const response = await axios.post(pinataUrl, formData, {
                headers: {
                    pinata_api_key: pinataApiKey,
                    pinata_secret_api_key: pinataSecretApiKey,
                    "Content-Type": "multipart/form-data",
                },
            });

            const imageUrl = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;

            const pinata = new PinataSDK({
                pinataJwt: pinataSecretJWT,
                pinataGateway: pinataUrl,
            });

            const upload = await pinata.upload
                .json({
                    imageUrl: imageUrl,
                    name: newItemName,
                    price: newItemPrice,
                })
                .addMetadata({
                    name: newItemName + ".json",
                });
            console.log(upload);
            return imageUrl; // IPFS URL
        } catch (error) {
            console.error("Error uploading image to Pinata:", error);
            throw new Error("Image upload failed");
        }
    };

    const createItem = async () => {
        if (!newItemName || !newItemPrice || !newItemImage) {
            setError("All fields are required.");
            return;
        }
        if (newItemName.length < 3 || newItemName.length > 100) {
            setError("Item name should be between 3 and 100 characters.");
            return;
        }
        if (isNaN(newItemPrice) || Number(newItemPrice) <= 0) {
            setError("Price must be a positive number.");
            return;
        }

        let imageUrl;
        try {
            imageUrl = await handleImageUpload(); // Upload the image and get the IPFS URL
        } catch (err) {
            setError("Failed to upload image");
            return;
        }

        try {
            await contract.methods.createItem(newItemName, Number(newItemPrice), imageUrl).send({ from: accounts[0] });
            getListItem(contract);
            setNewItemName("");
            setNewItemPrice("");
            setNewItemImage(null);
            setError("");
        } catch (err) {
            console.error("Error creating item:", err);
            setError(`Failed to create item. Error: ${err.message}`);
        }
    };

    const purchaseItem = async (itemId, itemPrice) => {
        try {
            await contract.methods.purchaseItem(itemId).send({ from: accounts[0], value: itemPrice });
            getListItem(contract);
        } catch (err) {
            console.error("Error purchasing item:", err);
            setError("");
        }
    };

    const triggerReceived = async (itemId) => {
        try {
            await contract.methods.delivery(itemId).send({ from: accounts[0] });
            getListItem(contract);
        } catch (err) {
            console.error("Error purchasing item:", err);
            setError("Failed to purchase item. Please try again.");
        }
    };

    const hideItem = async (itemId) => {
        try {
            await contract.methods.hideItem(itemId).send({ from: accounts[0] });
            getListItem(contract);
        } catch (err) {
            console.error("Error hiding item:", err);
            setError("Failed to hide item. Please try again.");
        }
    };

    const unhideItem = async (itemId) => {
        try {
            await contract.methods.unhideItem(itemId).send({ from: accounts[0] });
            getListItem(contract);
        } catch (err) {
            console.error("Error unhiding item:", err);
            setError("Failed to unhide item. Please try again.");
        }
    };

    const getListItem = useCallback(async (contract) => {
        try {
            const totalSupply = await contract.methods.totalSupply().call();
            const totalSupplyNumber = Number(totalSupply);
            const _ListItem = [];
            for (let itemId = 0; itemId < totalSupplyNumber; itemId++) {
                const item = await contract.methods.items(itemId).call();
                const { name, owner, price, state, isHidden, imageUrl } = item;
                _ListItem.push({ name, owner, price, state, id: itemId, isHidden, image: imageUrl });
            }
            setListItem(_ListItem);
        } catch (err) {
            console.error("Error fetching list items:", err);
            setError("");
        }
    }, []);

    useEffect(() => {
        if (contract) {
            getListItem(contract);
        }
    }, [contract, getListItem, showHidden]);

    const toggleHiddenItems = () => {
        setShowHidden(!showHidden);
    };

    // Filtered items based on search term
    const filteredItems = listItem.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="container bg-white rounded-3 shadow-sm p-3">
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <h1>MARKETPLACE</h1>
            </div>

            <div style={{ border: "1px solid #ccc", borderRadius: "5px", marginBottom: "5px ", padding: "10px", display: "inline-block", width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>Contract address: {contract?.options?.address}</div>
                    <div>Your address: {accounts ? accounts[0] : "Not connected"}</div>
                </div>
            </div>

            <hr />

            <div style={{ border: "1px solid #ccc", borderRadius: "5px", padding: "10px", display: "inline-block", width: "100%" }}>
                <div style={{ display: "flex", gap: "10px", flexDirection: "column", marginBottom: "20px" }}>
                    <input type="text" className="form-control" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item Name" />
                    <input type="text" className="form-control" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="Item Price" />
                    <input type="file" className="form-control" onChange={(e) => setNewItemImage(e.target.files[0])} />
                    <button className="btn btn-primary mt-3" onClick={createItem}>
                        Add New Item
                    </button>
                    {error && <p style={{ color: "red" }}>{error}</p>}
                </div>

                <hr />

                <input type="text" className="form-control mb-3" placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />

                <button className="btn btn-secondary mb-3" onClick={toggleHiddenItems}>
                    {showHidden ? "Hide Hidden Items" : "Show Hidden Items"}
                </button>

                <div className="row">
                    {filteredItems.length > 0 ? (
                        filteredItems
                            .filter((item) => !item.isHidden || showHidden)
                            .map((item) => (
                                <div key={item.id} className="col-12 col-md-6 col-lg-4 mb-3">
                                    <div className="card h-100">
                                        <img src={item.image} alt={item.name} className="card-img-top" />
                                        <div className="card-body">
                                            <h5 className="card-title">{item.name}</h5>
                                            <p className="card-text">Price: {item.price}</p>
                                            <p className="card-text">State: {Object.keys(ITEM_STATE).find((key) => ITEM_STATE[key] === item.state)}</p>
                                            <p className="card-text">Owner: {item.owner}</p>
                                            <button className="btn btn-success me-2" onClick={() => purchaseItem(item.id, item.price)}>
                                                Purchase
                                            </button>
                                            <button className="btn btn-info me-2" onClick={() => triggerReceived(item.id)}>
                                                Confirm Delivery
                                            </button>
                                            {item.isHidden ? (
                                                <button className="btn btn-secondary" onClick={() => unhideItem(item.id)}>
                                                    Unhide
                                                </button>
                                            ) : (
                                                <button className="btn btn-warning" onClick={() => hideItem(item.id)}>
                                                    Hide
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                    ) : (
                        <p>No items found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
