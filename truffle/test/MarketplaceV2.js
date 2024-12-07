const MarketplaceV2 = artifacts.require("MarketplaceV2");

contract("MarketplaceV2", (accounts) => {
    let marketplace;
    const owner = accounts[0];
    const buyer = accounts[1];
    const itemName = "Sample Item";
    const itemPrice = web3.utils.toWei("1", "ether"); // 1 ETH in Wei
    const itemImageUrl = "http://example.com/item.png";

    before(async () => {
        marketplace = await MarketplaceV2.deployed();
    });

    it("should create a new item", async () => {
        const initialSupply = await marketplace.totalSupply();

        await marketplace.createItem(itemName, itemPrice, itemImageUrl, { from: owner });
        const newSupply = await marketplace.totalSupply();

        assert.equal(newSupply.toNumber(), initialSupply.toNumber() + 1, "Item was not created successfully");

        const item = await marketplace.items(initialSupply);
        assert.equal(item.name, itemName, "Item name is incorrect");
        assert.equal(item.price.toString(), itemPrice, "Item price is incorrect");
        assert.equal(item.owner, owner, "Item owner is incorrect");
        assert.equal(item.state.toNumber(), 0, "Item state is incorrect");
    });

    it("should allow a buyer to purchase an item", async () => {
        const itemId = 0;

        await marketplace.purchaseItem(itemId, { from: buyer, value: itemPrice });
        const item = await marketplace.items(itemId);

        assert.equal(item.owner, buyer, "Item ownership did not transfer correctly");
        assert.equal(item.state.toNumber(), 1, "Item state did not update to 'Paid'");
    });

    it("should allow the buyer to mark the item as delivered", async () => {
        const itemId = 0;

        await marketplace.delivery(itemId, { from: buyer });
        const item = await marketplace.items(itemId);

        assert.equal(item.state.toNumber(), 2, "Item state did not update to 'Delivered'");
    });

    it("should allow the owner to hide the item", async () => {
        const itemId = 0;

        await marketplace.hideItem(itemId, { from: buyer });
        const item = await marketplace.items(itemId);

        assert.equal(item.isHidden, true, "Item was not hidden correctly");
    });

    it("should allow the owner to unhide the item", async () => {
        const itemId = 0;

        await marketplace.unhideItem(itemId, { from: buyer });
        const item = await marketplace.items(itemId);

        assert.equal(item.isHidden, false, "Item was not unhidden correctly");
    });

    it("should revert if an unauthorized user tries to hide an item", async () => {
        const itemId = 0;
        try {
            await marketplace.hideItem(itemId, { from: accounts[2] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert(error.message.includes("Only the owner can hide the item"), "Revert reason not as expected");
        }
    });

    it("should revert if an unauthorized user tries to unhide an item", async () => {
        const itemId = 0;
        try {
            await marketplace.unhideItem(itemId, { from: accounts[2] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert(error.message.includes("Only the owner can unhide the item"), "Revert reason not as expected");
        }
    });
});
