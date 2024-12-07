// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract MarketplaceV2 {
    enum ItemState {
        Created,
        Paid,
        Delivered
    }

    struct Item {
        string name;
        uint256 price;
        address owner;
        ItemState state;
        bool isHidden;
        string imageUrl;
    }

    uint256 private _itemId;
    mapping(uint256 => Item) public items;

    event ItemUpdate(uint256 itemId, ItemState itemState);

    function totalSupply() public view returns (uint256) {
        return _itemId;
    }

    function createItem(string memory name, uint256 price, string memory imageUrl) public {
        items[_itemId] = Item(name, price, msg.sender, ItemState.Created, false, imageUrl);
        emit ItemUpdate(_itemId, ItemState.Created);
        _itemId++;
    }

    function purchaseItem(uint256 itemId) public payable {
        Item memory item = items[itemId];
        require(item.price == msg.value, "MarketplaceV2: Only full payment accepted!");
        require(item.state == ItemState.Created, "MarketplaceV2: Item has been purchased!");
        require(item.owner != msg.sender, "MarketplaceV2: The buyer is seller!");
        payable(item.owner).transfer(item.price);
        items[itemId].owner = msg.sender;
        items[itemId].state = ItemState.Paid;
        emit ItemUpdate(itemId, ItemState.Paid);
    }

    function delivery(uint256 itemId) public payable {
        Item memory item = items[itemId];
        require(item.state == ItemState.Paid, "MarketplaceV2: Item has been delivered!");
        require(item.owner == msg.sender, "MarketplaceV2: You are not the purchaser!");
        items[itemId].state = ItemState.Delivered;
        emit ItemUpdate(itemId, ItemState.Delivered);
    }

    function hideItem(uint256 itemId) external {
        require(msg.sender == items[itemId].owner, "Only the owner can hide the item");
        items[itemId].isHidden = true;
    }

    function unhideItem(uint256 itemId) external {
        require(msg.sender == items[itemId].owner, "Only the owner can unhide the item");
        items[itemId].isHidden = false;
    }
}
