"""Generate all Tic-Tac-Toe positions unique up to D_4 (square) symmetry and
output them as a NetworkX JSON graph.

"""

import networkx as nx
from networkx.readwrite import json_graph
import json
import sys

EMPTY = ' '
X = 'x'
O = 'o'
BASE_STATE = ((EMPTY,) * 3,) * 3

def is_strip_done(strip):
    strip = list(strip)
    if strip[0] == EMPTY:
        return
    mark = strip[0]
    return all(cell == mark for cell in strip)

def transpose(state):
    return tuple(zip(*state))

def get_winner(state):
    # Check rows.
    for row in state:
        if is_strip_done(row):
            return row[0]

    # Check columns.
    for col in transpose(state):
        if is_strip_done(col):
            return col[0]

    # Check main diagonal.
    if is_strip_done(row[i] for i, row in enumerate(state)):
        return state[0][0]

    # Check antidiagonal.
    if is_strip_done(row[-i - 1] for i, row in enumerate(state)):
        return state[0][-1]

    if any(EMPTY in row for row in state):
        raise ValueError("board is not done")
    else:
        return None

def is_done(state):
    try:
        get_winner(state)
        return True
    except ValueError:
        return False

def successors(state, mark):
    if is_done(state):
        return

    for i, row in enumerate(state):
        for j, cell in enumerate(row):
            if cell == EMPTY:
                new_row = row[:j] + (mark,) + row[j + 1:]
                new_state = state[:i] + (new_row,) + state[i + 1:]
                yield new_state

def mirx(state):
    """Return state mirrored about the x-axis."""
    mirrored = list(state)
    for i in range(len(mirrored) // 2):
        j = len(mirrored) - i - 1
        mirrored[i], mirrored[j] = mirrored[j], mirrored[i]
    return tuple(mirrored)

def rotccw(state):
    """Return state rotated 90 degrees counterclockwise."""
    return mirx(transpose(state))

def miry(state):
    """Return state mirrored about the y-axis."""
    return transpose(mirx(transpose(state)))

def dia1(state):
    """Return state reflected about the main diagonal."""
    return rotccw(miry(state))

def dia2(state):
    """Return state reflected about the antidiagonal."""
    return rotccw(mirx(state))

def equivalents(state):
    """Generate all equivalent states up to D4 (square) symmetry."""
    yield state
    yield rotccw(state)
    yield rotccw(rotccw(state))
    yield rotccw(rotccw(rotccw(state)))
    yield mirx(state)
    yield miry(state)
    yield dia1(state)
    yield dia2(state)

def format_state(state):
    # Replace empty spaces with dash.
    return "/".join(("".join(row)).replace(EMPTY, "-") for row in state)

def print_state(state):
    for row in state:
        print(row)
    print("")

def construct_game_tree():
    G = nx.DiGraph()
    stack = [(X, BASE_STATE)]
    states = set()
    while stack:
        mark, state = stack.pop()
        if mark == X:
            new_mark = O
        else:
            new_mark = X
        parent_node = format_state(state)
        G.add_node(parent_node)

        for child in successors(state, mark):
            for equiv in equivalents(child):
                if equiv in states:
                    child_node = format_state(equiv)
                    G.add_edge(parent_node, child_node)
                    break
            else:
                child_node = format_state(child)
                G.add_edge(parent_node, child_node)
                stack.append((new_mark, child))
                states.add(child)
                # print_state(child)


    return G

def main():
    G = construct_game_tree()
    json.dump(json_graph.node_link_data(G), sys.stdout)
    sys.stderr.write("Number of nodes: %d\n" % G.number_of_nodes())
    numleaves = 0
    wins = {X: 0, O: 0, None: 0}
    for node in G.nodes():
        if G.out_degree(node) == 0:
            numleaves += 1
            wins[get_winner(node.split("/"))] += 1
            # for row in node.split("/"):
            #     sys.stderr.write("%s\n" % row)
            # sys.stderr.write("\n")
    sys.stderr.write("Number of leaves: %d\n" % numleaves)
    sys.stderr.write("Wins: %r\n" % wins)

if __name__ == '__main__':
    main()
