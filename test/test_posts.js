const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { sha256 } = require("ethers/lib/utils");
const utils = require("../scripts/utils.js");

describe("Posts", function () {

    let rate_control;
    let accounts;
    let spaces;
    let posts;
    let nonces = [];

    let message = "Hola, mundo!";

    it("Should be able to deploy contract", async function () {

        contracts = await utils.deploy_proxy("Contracts");

        rate_control = await utils.deploy_proxy("RateControl");
        tokens = await utils.deploy_proxy("Tokens", []);
        accounts = await utils.deploy_proxy("Accounts", [contracts.address]);
        spaces = await utils.deploy_proxy("Spaces", [contracts.address]);
        posts = await utils.deploy_proxy("Posts", [contracts.address]);

        await rate_control.set_rate((await utils.own_address()), 10);

        for(let i = 0; i < 1; i++) {
            let nonce = "nonce#"+i;
            nonces.push(nonce);
            let hash = sha256(utils.string_to_bytes(nonce));
            await tokens.add_token_hash(hash)
        }

        await contracts.set_rate_control(rate_control.address);
        await contracts.set_accounts(accounts.address);
        await contracts.set_spaces(spaces.address);
        await contracts.set_posts(posts.address);
        await contracts.set_tokens(tokens.address);
    });

    it("get_amount_of_posts() should be 0 after deployment", async function () {
        expect(await posts.get_amount_of_posts()).to.equal(0);
    });

    it("Should not be able to submit a post before signing up", async function () {
        utils.expect_error_message(async () => {
            await utils.submit_post(posts, 0, message)
        }, "Cannot submit post: you are not signed up");
    });

    it("Submit a post to space", async function () {
        await accounts.sign_up("micro_hash", nonces.pop());
        await spaces.create("space1", "", "0x0000000000000000000000000000000000000000");
        await utils.submit_post(posts, 1, message)
    });

    it("get_amount_of_posts() should be 1 after first post submitted", async function () {
        expect(await posts.get_amount_of_posts()).to.equal(1);
    });

    it("posts_length_by_space(space) should be 1 after first post submitted to space", async function () {
        expect(await posts.get_amount_of_posts_by_space(1)).to.equal(1);
    });

    it("Should not be able to submit posts when blacklisted", async function () {
        await spaces.add_account_to_blacklist(1, 1);
        utils.expect_error_message(async () => {
            await utils.submit_post(posts, 1, message)
        }, "Cannot submit post: you are on this space's blacklist");
    });

    it("Submit post after removed from blacklist", async function () {
        await spaces.remove_account_from_blacklist(1, 1);
        await utils.submit_post(posts, 1, message)
    });

    it("Post on blockchain should equal post submitted", async function () {
        const [ret_message, ret_author, _, __] = await posts.posts(1);
        expect(ret_message).to.equal(message);
        let [_1, _2, _3, author_address] = await accounts.accounts(ret_author);
        expect(author_address).to.equal(await utils.own_address());
    });

    it("can delete post", async function () {
        let post_index = await posts.get_amount_of_posts();
        await posts.delete_post(post_index);
        let [_0, _1, _2, _3, _4, deleted] = await posts.posts(post_index);
        expect(deleted, "Post is not deleted");
    });

    it("Should be able to reply to post", async function () {
        let message = "This is a reply";
        let mother_post_index = await posts.get_amount_of_posts();
        await posts.submit_reply(mother_post_index, message);

        let reply_index = await posts.get_amount_of_posts();
        expect(reply_index > mother_post_index, "no post submitted");

        const [ret_message, _, __, ___, mother_post_index_as_read] = await posts.posts(reply_index);
        expect(ret_message).to.equal(message, "Unexpected post message");

        let first_reply = await posts.replies_by_post(mother_post_index, 0);
        expect(first_reply).to.equal(reply_index, "reply was not added as reply to mother post");

        expect(mother_post_index_as_read).to.equal(mother_post_index, "mother post was not added as mother post to reply");
    });
});