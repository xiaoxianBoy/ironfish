/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { ArrayUtils } from '../../utils/array'
import { Identity } from '../identity'
import { ConnectionRetry } from './connectionRetry'
import { Peer, WebSocketAddress } from './peer'

export type PeerCandidate = {
  name?: string
  address: string | null
  port: number | null
  neighbors: Set<Identity>
  webRtcRetry: ConnectionRetry
  websocketRetry: ConnectionRetry
  /**
   * UTC timestamp. If set, the peer manager should not initiate connections to the
   * Peer until after the timestamp.
   */
  peerRequestedDisconnectUntil: number | null
  /**
   * UTC timestamp. If set, the peer manager should not accept connections from the
   * Peer until after the timestamp.
   */
  localRequestedDisconnectUntil: number | null
}

export class PeerCandidates {
  private readonly map: Map<Identity, PeerCandidate> = new Map()

  get size(): number {
    return this.map.size
  }

  addFromPeer(peer: Peer, neighbors = new Set<Identity>()): void {
    const address = peer.getWebSocketAddress()
    const addressPeerCandidate = this.map.get(address)
    const newPeerCandidate = {
      address: peer.address,
      port: peer.port,
      neighbors,
      webRtcRetry: new ConnectionRetry(peer.isWhitelisted),
      websocketRetry: new ConnectionRetry(peer.isWhitelisted),
      localRequestedDisconnectUntil: null,
      peerRequestedDisconnectUntil: null,
    }

    if (peer.state.identity !== null) {
      if (addressPeerCandidate) {
        this.map.delete(address)
      }

      if (!this.map.has(peer.state.identity)) {
        this.map.set(peer.state.identity, addressPeerCandidate ?? newPeerCandidate)
      }
    } else if (!addressPeerCandidate) {
      this.map.set(address, newPeerCandidate)
    }
  }

  addFromPeerList(
    sendingPeerIdentity: Identity,
    peer: {
      identity: Identity
      name?: string
      wsAddress: WebSocketAddress | null
    },
  ): void {
    const peerCandidateValue = this.map.get(peer.identity)

    if (peerCandidateValue) {
      peerCandidateValue.neighbors.add(sendingPeerIdentity)
    } else {
      const tempPeer = new Peer(peer.identity)
      tempPeer.setWebSocketAddress(peer.wsAddress)
      this.addFromPeer(tempPeer, new Set([sendingPeerIdentity]))
    }
  }

  shufflePeerCandidates(): string[] {
    return ArrayUtils.shuffle([...this.map.keys()])
  }

  get(identity: Identity): PeerCandidate | undefined {
    return this.map.get(identity)
  }

  has(identity: Identity): boolean {
    return this.map.has(identity)
  }

  clear(): void {
    this.map.clear()
  }
}
